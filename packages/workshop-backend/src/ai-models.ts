import { DurableObject, RpcStub, RpcTarget } from "cloudflare:workers";
import { validateRpc } from "capnweb-validate";
import type {
  Api, AssistantMessageEventStream, Context, Model, ModelCost, ProviderHeaders,
  SimpleStreamOptions, StreamFunction,
} from "@earendil-works/pi-ai";
import { stream as openaiCompletionsStream } from "@earendil-works/pi-ai/api/openai-completions";
import { ApprovalQueue, Gatekeeper, ResourceDescription } from '@gadgets/workshop-shared/gatekeeper';
import { LanguageModelBinding } from "./ai-model-binding";
import AI_MODEL_BINDING_TYPES from "./ai-model-binding.txt";
import {
  AiChatAuthorInfo, AiModelConfig, ANYROUTER_DEFAULT_API_URL, SUGGESTED_MODELS,
} from "@gadgets/workshop-shared/api";
import { completeText } from "./ai-invoke.js";
import { bridgePdfAttachments } from "./chat-attachment-pdf.js";

type ModelRoutingOptions = {
  sessionAffinity?: string;
};

/**
 * Per-call stream options accepted by a ModelHandle, extending pi's own options with
 * handle-level knobs.
 */
export type ModelStreamOptions = SimpleStreamOptions & {
  /**
   * When false, suppress the handle's per-API thinking/reasoning defaults so the request runs
   * without extended thinking (as far as the model allows). Used by completeText(): one-shot
   * calls -- titles, binding names, compaction summaries, gadget model bindings -- should be
   * quick, and none of them benefit from cross-step reasoning. Default: true.
   */
  thinking?: boolean;
};

/**
 * A resolved model plus everything needed to stream from it: `stream` closes over the routing
 * (endpoint, auth headers, session affinity) chosen by getModel(), so callers never handle
 * credentials themselves. pi streams never throw/reject for provider failures; failures surface
 * as a final AssistantMessage with stopReason "error"/"aborted".
 */
export type ModelHandle = {
  /** pi model descriptor (plain data; pi dispatches purely on `model.api`). */
  model: Model<Api>;

  /**
   * Streams a response. Merges the handle's routing/auth and per-API options into whatever
   * per-call options the caller (e.g. the agent loop) passes. Assignable to pi-agent-core's
   * StreamFn (the extra ModelStreamOptions knobs are optional).
   */
  stream: (model: Model<Api>, context: Context, options?: ModelStreamOptions)
      => AssistantMessageEventStream;

  /**
   * Status of the most recent HTTP response observed by `stream`. Reset at the start of every
   * request and set from pi's onResponse callback (which fires only once a response arrives --
   * an SDK-level failure leaves this undefined), so consumers must read it right after the
   * request they care about completes. Turns run requests sequentially, so this is safe.
   */
  lastResponse?: { status: number };
};

const ZERO_COST: ModelCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

// Token limits for a synthesized model. SUGGESTED_MODELS remains authoritative (compaction
// budgets in agent-compaction.ts are computed from it and must not change); unknown models get
// conservative defaults.
function modelTokenWindow(config: AiModelConfig): { contextWindow: number, maxTokens: number } {
  const suggested = SUGGESTED_MODELS[config.provider]?.[config.model];
  return {
    contextWindow: suggested?.contextWindow ?? 128_000,
    maxTokens: suggested?.outputLimit ?? 4096,
  };
}

type HandleArgs = {
  model: Model<Api>;
  apiKey: string;
  sessionAffinity?: string;
};

function makeHandle(args: HandleArgs): ModelHandle {
  const handle: ModelHandle = {
    model: args.model,
    stream: (model, context, { thinking: _thinking = true, ...options } = {}) => {
      // Never let a failed request read a previous request's response metadata.
      handle.lastResponse = undefined;
      const headers: ProviderHeaders = { ...options.headers };
      const merged: SimpleStreamOptions = {
        ...options,
        apiKey: args.apiKey,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        // Session affinity: pi only sends it when caching isn't "none" (fine for us).
        sessionId: options.sessionId ?? args.sessionAffinity,
        onResponse: async (response, responseModel) => {
          handle.lastResponse = { status: response.status };
          await options.onResponse?.(response, responseModel);
        },
        // PDF attachments ride pi image parts and are rewritten here into the provider's native
        // document blocks (no-op for payloads without one; see chat-attachment-pdf.ts).
        onPayload: async (payload, payloadModel) => {
          const replaced = await options.onPayload?.(payload, payloadModel);
          return bridgePdfAttachments(args.model.api, replaced ?? payload) ?? replaced;
        },
      };
      return (openaiCompletionsStream as StreamFunction<Api, SimpleStreamOptions>)(
          model, context, merged);
    },
  };
  return handle;
}

/**
 * Resolve an AiModelConfig to a ModelHandle. AnyRouter is the only provider: a multi-provider
 * OpenAI-compatible gateway (https://anyrouter.dev/docs). Base is …/api/v1 so openai-completions
 * hits /chat/completions for every upstream id (provider/model). Auth: config.apiToken only —
 * never hardcode a key.
 */
export function getModel(env: Cloudflare.Env, config: AiModelConfig,
                         initiator: AiChatAuthorInfo,
                         options: ModelRoutingOptions = {}): ModelHandle {
  config.provider satisfies "anyrouter";
  const baseUrl = (config.apiUrl ?? ANYROUTER_DEFAULT_API_URL).replace(/\/+$/, "");
  return makeHandle({
    model: {
      id: config.model,
      name: config.model,
      api: "openai-completions",
      provider: "anyrouter",
      baseUrl,
      reasoning: true,
      input: ["text", "image"],
      cost: ZERO_COST,
      ...modelTokenWindow(config),
    },
    apiKey: config.apiToken,
    sessionAffinity: options.sessionAffinity,
  });
}

// =======================================================================================

export type LanguageModelGatekeeperProps = {
  displayName: string,
  config: AiModelConfig,
  initiator: AiChatAuthorInfo,
};

export class LanguageModelGatekeeper
    extends DurableObject<Cloudflare.Env, LanguageModelGatekeeperProps>
    implements Gatekeeper<LanguageModelBinding> {
  async describe(): Promise<ResourceDescription> {
    let modelConfig = this.ctx.props.config;
    let displayName = this.ctx.props.displayName;

    return {
      // TODO: Decide if we need real URLs or if `url` should stop being part of the description.
      url: `http://models.local/${modelConfig.provider}/${modelConfig.model}`,

      title: displayName,
      snippet: "An AI large language model.",

      suggestedBindingName: "LLM",

      tsType: "LanguageModelBinding",
    };
  }

  async getTypeScriptTypes(): Promise<string> {
    return AI_MODEL_BINDING_TYPES;
  }

  async getAutoApprovableActions() {
    return [];
  }

  async startSession(approvalQueue: RpcStub<ApprovalQueue>)
      : Promise<LanguageModelBinding> {
    let model = getModel(this.env, this.ctx.props.config, this.ctx.props.initiator);
    return new LanguageModelBindingImpl(model);
  }

  applyAction(action: number): Promise<void> {
    throw new Error("This gatekeeper implements no actions.");
  }
  rejectAction(action: number): Promise<void | {restart?: boolean}> {
    throw new Error("This gatekeeper implements no actions.");
  }
  revertAction(action: number):
      Promise<void | {message?: string, canRetry?: boolean, restart?: boolean}> {
    throw new Error("This gatekeeper implements no actions.");
  }

  async addObserver(_id: string, _user: Fetcher): Promise<void> {
    // An AI model is not a restricted-access resource: nothing read through it identifies the
    // observer or leaks private data, so any observer is permitted. No-op (never throws).
  }

  async removeObserver(_id: string): Promise<void> {
    // No observer state is tracked (see addObserver). Idempotent no-op.
  }
}

@validateRpc()
class LanguageModelBindingImpl extends RpcTarget implements LanguageModelBinding {
  constructor(private model: ModelHandle) {
    super();
  }

  async run(options: {prompt: string, systemPrompt?: string}): Promise<string> {
    // TODO: Should we be calling authorizeObservation() here? It's not really observing anything,
    //   but you might want the audit logs?
    // TODO: Account LLM costs back to the calling gadget.
    return await completeText(this.model, {
      prompt: options.prompt,
      systemPrompt: options.systemPrompt,
    });
  }
}
