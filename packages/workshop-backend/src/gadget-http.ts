import { RpcStub, RpcTarget } from "capnweb";
import {
  AUTH_ERROR_CODES,
  getAuthErrorCode,
  getOpenGadgetErrorCode,
  OPEN_GADGET_ERROR_CODES,
  type AuthenticatedApi,
  type GadgetHttpCallRequest,
  type GadgetHttpCallResponse,
  type GadgetHttpUiResponse,
  type PublicApi,
  type WorkpieceId,
} from "@gadgets/workshop-shared/api";
import { createWorkshopLogger } from "./observability";

const logger = createWorkshopLogger("workshop.gadget-http");

const MAX_CALL_BODY_BYTES = 64 * 1024;
const GADGET_HTTP_PATH = /^\/api\/workspaces\/([^/]+)\/gadgets\/([^/]+)\/(ui|call)$/;
const METHOD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORBIDDEN_METHODS = new Set([
  "__proto__", "constructor", "prototype", "then",
  "dup", "fetch", "connect", "onRpcBroken",
]);

type GadgetHttpAction = "ui" | "call";
type GadgetHttpMatch = {
  workspaceId: string;
  gadgetId: WorkpieceId;
  action: GadgetHttpAction;
};

/** PublicApi.authenticate is the session authority for this HTTP surface. */
type GadgetHttpPublicApi = Pick<PublicApi, "authenticate">;

function parseWorkpieceId(raw: string): WorkpieceId | undefined {
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) return undefined;
  let id = Number(raw);
  if (!Number.isSafeInteger(id)) return undefined;
  return id;
}

function matchGadgetHttpPath(pathname: string): GadgetHttpMatch | "bad-request" | null {
  let match = GADGET_HTTP_PATH.exec(pathname);
  if (!match) return null;
  try {
    let workspaceId = decodeURIComponent(match[1]);
    let gadgetId = parseWorkpieceId(decodeURIComponent(match[2]));
    if (!workspaceId || gadgetId === undefined) return "bad-request";
    return { workspaceId, gadgetId, action: match[3] as GadgetHttpAction };
  } catch (error) {
    if (error instanceof URIError) return "bad-request";
    throw error;
  }
}

function sessionTokenFromRequest(request: Request): string | undefined {
  let authorization = request.headers.get("authorization");
  if (!authorization) return undefined;
  let bearer = /^Bearer\s+(\S+)/i.exec(authorization);
  return bearer?.[1];
}

function textResponse(status: number, body: string, extra?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...extra },
  });
}

function jsonResponse(status: number, body: GadgetHttpCallResponse | GadgetHttpUiResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function disposeQuietly(value: unknown): void {
  if (value == null) return;
  try {
    let dispose = (value as { [Symbol.dispose]?: () => void })[Symbol.dispose];
    dispose?.();
  } catch {
    // HTTP is short-lived; a dispose failure must not mask the response.
  }
}

function isSafeMethodName(method: string): boolean {
  return METHOD_NAME.test(method) && !FORBIDDEN_METHODS.has(method);
}

function looksLikeRpcStub(value: object): boolean {
  return typeof value === "function" || typeof (value as { dup?: unknown }).dup === "function";
}

/**
 * Resolves a gadget server method. Bindings live on `this.env` and are not methods, so they
 * cannot be selected here. Stub/Fetcher protocol names are never callable over HTTP.
 */
function lookupGadgetMethod(
    gadget: object, method: string): ((...args: unknown[]) => unknown) | undefined {
  if (!isSafeMethodName(method)) return undefined;

  let value = (gadget as Record<string, unknown>)[method];
  if (typeof value !== "function") return undefined;
  if ((Object.prototype as Record<string, unknown>)[method] === value) return undefined;

  // Plain objects (tests, and any non-stub facet) must expose the method as own-enumerable so
  // HTTP cannot climb to inherited names. Rpc stubs hide the method table behind a proxy.
  if (!looksLikeRpcStub(gadget) && !Object.prototype.propertyIsEnumerable.call(gadget, method)) {
    return undefined;
  }
  return value as (...args: unknown[]) => unknown;
}

function containsCapability(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "function") return true;
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (value instanceof RpcTarget || value instanceof RpcStub) return true;
  if (looksLikeRpcStub(value)) return true;
  if (Array.isArray(value)) {
    return value.some(entry => containsCapability(entry, seen));
  }
  for (let entry of Object.values(value)) {
    if (containsCapability(entry, seen)) return true;
  }
  return false;
}

async function readBoundedJson(request: Request): Promise<unknown | "too-large" | "invalid"> {
  let declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_CALL_BODY_BYTES) return "too-large";
  if (!request.body) return "invalid";

  let reader = request.body.getReader();
  let chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      let { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_CALL_BODY_BYTES) {
        await reader.cancel();
        return "too-large";
      }
      chunks.push(value);
    }
    let bytes = new Uint8Array(length);
    let offset = 0;
    for (let chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return "invalid";
  } finally {
    reader.releaseLock();
  }
}

async function readCallRequest(request: Request): Promise<GadgetHttpCallRequest | Response> {
  let raw = await readBoundedJson(request);
  if (raw === "too-large") return jsonResponse(413, { ok: false, error: "Payload Too Large" });
  if (raw === "invalid") return jsonResponse(400, { ok: false, error: "Invalid JSON" });
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return jsonResponse(400, { ok: false, error: "Expected a JSON object." });
  }

  let method = (raw as { method?: unknown }).method;
  let args = (raw as { args?: unknown }).args;
  if (typeof method !== "string") {
    return jsonResponse(400, { ok: false, error: "method must be a string." });
  }
  if (args !== undefined && !Array.isArray(args)) {
    return jsonResponse(400, { ok: false, error: "args must be an array." });
  }
  return { method, ...(args !== undefined ? { args } : {}) };
}

async function resolveGadgetClient(
    publicApi: GadgetHttpPublicApi, token: string,
    workspaceId: string, gadgetId: WorkpieceId) {
  let session: Awaited<ReturnType<PublicApi["authenticate"]>>;
  try {
    session = await publicApi.authenticate(token);
  } catch (error) {
    if (getAuthErrorCode(error) !== AUTH_ERROR_CODES.invalidSessionToken) {
      logger.warn("gadget http authenticate failed", {
        event: "gadget.http.authenticate.failed", gadgetId: String(gadgetId), error,
      });
    }
    return textResponse(401, "Unauthorized");
  }

  let overseer: Awaited<ReturnType<AuthenticatedApi["openGadget"]>>;
  try {
    overseer = await session.openGadget(workspaceId);
  } catch (error) {
    disposeQuietly(session);
    let code = getOpenGadgetErrorCode(error);
    if (code !== OPEN_GADGET_ERROR_CODES.workspaceNotFound &&
        code !== OPEN_GADGET_ERROR_CODES.workspaceAccessDenied) {
      logger.warn("gadget http open failed", {
        event: "gadget.http.open.failed", gadgetId: String(gadgetId), error,
      });
    }
    return textResponse(404, "Not Found");
  }

  try {
    let gadget = await overseer.getGadget(gadgetId);
    return { session, overseer, gadget };
  } catch (error) {
    disposeQuietly(overseer);
    disposeQuietly(session);
    logger.warn("gadget http gadget resolve failed", {
      event: "gadget.http.gadget.failed", gadgetId: String(gadgetId), error,
    });
    return textResponse(404, "Not Found");
  }
}

async function serveUi(
    publicApi: GadgetHttpPublicApi, token: string,
    workspaceId: string, gadgetId: WorkpieceId): Promise<Response> {
  let resolved = await resolveGadgetClient(publicApi, token, workspaceId, gadgetId);
  if (resolved instanceof Response) return resolved;
  let { session, overseer, gadget } = resolved;
  try {
    let bundle = await gadget.getUiBundle();
    if (!bundle) return textResponse(404, "Not Found");
    return jsonResponse(200, { jsCode: bundle.jsCode });
  } finally {
    disposeQuietly(gadget);
    disposeQuietly(overseer);
    disposeQuietly(session);
  }
}

async function serveCall(
    request: Request, publicApi: GadgetHttpPublicApi, token: string,
    workspaceId: string, gadgetId: WorkpieceId): Promise<Response> {
  let contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return textResponse(415, "Expected application/json.");
  }

  let body = await readCallRequest(request);
  if (body instanceof Response) return body;

  let resolved = await resolveGadgetClient(publicApi, token, workspaceId, gadgetId);
  if (resolved instanceof Response) return resolved;
  let { session, overseer, gadget: gadgetClient } = resolved;
  let facet: unknown;
  try {
    try {
      facet = await gadgetClient.connectToGadget();
    } catch (error) {
      logger.warn("gadget http connect failed", {
        event: "gadget.http.connect.failed", gadgetId: String(gadgetId), error,
      });
      return jsonResponse(500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (facet === null || (typeof facet !== "object" && typeof facet !== "function")) {
      return jsonResponse(500, { ok: false, error: "Gadget server is not callable." });
    }

    let method = lookupGadgetMethod(facet, body.method);
    if (!method) {
      // Missing methods 404 rather than reflecting into this.env: bindings are not HTTP methods.
      return jsonResponse(404, { ok: false, error: `No such method: ${body.method}` });
    }

    let result: unknown;
    try {
      result = await method.apply(facet, body.args ?? []);
    } catch (error) {
      logger.warn("gadget http method failed", {
        event: "gadget.http.call.failed", gadgetId: String(gadgetId), error,
      });
      return jsonResponse(200, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (containsCapability(result)) {
      disposeQuietly(result);
      return jsonResponse(501, { ok: false, error: "HTTP cannot return capabilities." });
    }

    try {
      return jsonResponse(200, { ok: true, result });
    } catch (error) {
      logger.warn("gadget http result not serializable", {
        event: "gadget.http.call.serialize.failed", gadgetId: String(gadgetId), error,
      });
      return jsonResponse(500, { ok: false, error: "Result is not JSON-serializable." });
    }
  } finally {
    disposeQuietly(facet);
    disposeQuietly(gadgetClient);
    disposeQuietly(overseer);
    disposeQuietly(session);
  }
}

/**
 * Authenticated JSON HTTP for gadget UI and server method calls.
 *
 * Session tokens (Bearer) are the authority. Bindings are never exposed: POST /call may
 * invoke gadget methods only. `gadgetId` is a workpiece id, resolved on the named workspace.
 *
 * Returns null when the path is not a gadget HTTP route.
 */
export async function handleGadgetHttpRequest(
    request: Request, publicApi: GadgetHttpPublicApi): Promise<Response | null> {
  let url = new URL(request.url);
  let match = matchGadgetHttpPath(url.pathname);
  if (match === null) return null;
  if (match === "bad-request") return textResponse(400, "Bad Request");

  let allowed = match.action === "ui" ? "GET" : "POST";
  if (request.method !== allowed) {
    return textResponse(405, "Method Not Allowed", { allow: allowed });
  }

  let token = sessionTokenFromRequest(request);
  if (!token) return textResponse(401, "Unauthorized");

  // GET /ui is JSON (not a first-party document) so it does not need POST CSRF.
  // Bearer is not sent automatically cross-origin; a missing Origin is allowed.
  if (match.action === "call") {
    let origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return textResponse(403, "Cross-origin API access not allowed.");
    }
  }

  if (match.action === "ui") {
    return serveUi(publicApi, token, match.workspaceId, match.gadgetId);
  }
  return serveCall(request, publicApi, token, match.workspaceId, match.gadgetId);
}
