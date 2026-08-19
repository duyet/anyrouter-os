import { describe, expect, it } from "vitest";
import { RpcTarget } from "capnweb";
import {
  AUTH_ERROR_CODES,
  createAuthError,
  createOpenGadgetError,
  OPEN_GADGET_ERROR_CODES,
  type AuthenticatedApi,
  type GadgetHttpCallResponse,
  type PublicApi,
  type UiBundle,
  type WorkpieceId,
} from "@gadgets/workshop-shared/api";
import { handleGadgetHttpRequest } from "../src/gadget-http.js";

const TOKEN = "alice:session-secret";
const WORKSPACE_ID = "workspace-do-id";
const GADGET_ID = 7;
const ORIGIN = "https://workshop.example";
const CALL_PATH = `/api/workspaces/${WORKSPACE_ID}/gadgets/${GADGET_ID}/call`;
const UI_PATH = `/api/workspaces/${WORKSPACE_ID}/gadgets/${GADGET_ID}/ui`;

type FakeGadget = {
  ping: (value?: unknown) => unknown;
  echo: (...args: unknown[]) => unknown;
  env: { secretBinding: { send: () => never } };
  capability?: () => unknown;
  nested?: () => unknown;
  list?: () => unknown;
};

function fixtureGadget(overrides: Partial<FakeGadget> = {}): FakeGadget {
  return {
    ping(value = "pong") { return value; },
    echo(...args: unknown[]) { return { args }; },
    env: {
      secretBinding: {
        send() { throw new Error("bindings are not an HTTP surface"); },
      },
    },
    ...overrides,
  };
}

function fakePublicApi(options: {
  token?: string;
  workspaceId?: string;
  ui?: UiBundle | null;
  gadget?: object;
  openError?: Error;
  getGadgetError?: Error;
  connectToGadget?: () => unknown;
  getGadgetIds?: WorkpieceId[];
} = {}): Pick<PublicApi, "authenticate"> {
  let expectedToken = options.token ?? TOKEN;
  let expectedWorkspaceId = options.workspaceId ?? WORKSPACE_ID;
  let gadget = options.gadget ?? fixtureGadget();
  let ui: UiBundle | null = options.ui === undefined ? { jsCode: "export const ready = true;\n" } : options.ui;
  let getGadgetIds = options.getGadgetIds;

  return {
    async authenticate(token: string) {
      if (token !== expectedToken) throw createAuthError(AUTH_ERROR_CODES.invalidSessionToken);
      let session: Pick<AuthenticatedApi, "openGadget"> = {
        async openGadget(id: string) {
          if (options.openError) throw options.openError;
          if (id !== expectedWorkspaceId) {
            throw createOpenGadgetError(OPEN_GADGET_ERROR_CODES.workspaceNotFound);
          }
          return {
            async getGadget(gadgetId: WorkpieceId) {
              getGadgetIds?.push(gadgetId);
              if (options.getGadgetError) throw options.getGadgetError;
              return {
                async getUiBundle() { return ui; },
                connectToGadget() {
                  if (options.connectToGadget) return options.connectToGadget();
                  return gadget;
                },
              };
            },
          } as Awaited<ReturnType<AuthenticatedApi["openGadget"]>>;
        },
      };
      return session as Awaited<ReturnType<PublicApi["authenticate"]>>;
    },
  };
}

function request(
    path: string,
    init: RequestInit = {},
    headers: Record<string, string> = {}): Request {
  return new Request(`https://workshop.example${path}`, {
    ...init,
    headers: {
      origin: ORIGIN,
      authorization: `Bearer ${TOKEN}`,
      ...headers,
    },
  });
}

function callRequest(
    body: unknown,
    headers: Record<string, string> = {},
    init: RequestInit = {}): Request {
  return request(CALL_PATH, {
    method: "POST",
    body: typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body),
    ...init,
  }, {
    "content-type": "application/json",
    ...headers,
  });
}

async function handle(
    req: Request,
    publicApi: Pick<PublicApi, "authenticate"> = fakePublicApi()): Promise<Response> {
  let response = await handleGadgetHttpRequest(req, publicApi);
  if (!response) throw new Error("expected a gadget HTTP response");
  return response;
}

async function callJson(req: Request, publicApi?: Pick<PublicApi, "authenticate">)
    : Promise<{ status: number; body: GadgetHttpCallResponse }> {
  let response = await handle(req, publicApi);
  return { status: response.status, body: await response.json() as GadgetHttpCallResponse };
}

describe("gadget HTTP API", () => {
  it("returns 401 without a session token because the session is the authority", async () => {
    // Bindings and gadget methods are not ambient: knowing the ids is not enough.
    let response = await handle(request(CALL_PATH, {
      method: "POST",
      body: JSON.stringify({ method: "ping" }),
    }, { authorization: "", "content-type": "application/json" }));

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("returns 401 for an invalid session token rather than opening the gadget", async () => {
    let response = await handle(callRequest({ method: "ping" }, {
      authorization: "Bearer not-a-session",
    }));
    expect(response.status).toBe(401);
  });

  it("does not accept a session cookie; Bearer is the only authority", async () => {
    let response = await handle(callRequest({ method: "ping" }, {
      authorization: "",
      cookie: "authToken=" + encodeURIComponent(TOKEN),
    }));
    expect(response.status).toBe(401);
  });

  it("returns 403 when Origin is present and not the request origin", async () => {
    // A page that can set Authorization still must not CSRF from another origin.
    let opened = false;
    let publicApi = fakePublicApi();
    let wrapped: Pick<PublicApi, "authenticate"> = {
      async authenticate(token: string) {
        opened = true;
        return publicApi.authenticate(token);
      },
    };

    let response = await handle(callRequest({ method: "ping" }, {
      origin: "https://evil.example",
    }), wrapped);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Cross-origin API access not allowed.");
    expect(opened).toBe(false);
  });

  it("allows a missing Origin on Bearer POST because cookies are not used", async () => {
    let { status, body } = await callJson(callRequest({ method: "ping" }, { origin: "" }));
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, result: "pong" });
  });

  it("returns 405 for the wrong method on each route", async () => {
    expect((await handle(request(UI_PATH, { method: "POST" }))).status).toBe(405);
    expect((await handle(request(CALL_PATH, { method: "GET" }))).status).toBe(405);
    expect((await handle(callRequest({ method: "ping" }, {}, { method: "PUT" }))).status)
        .toBe(405);
  });

  it("returns 400 when the gadget id is not a workpiece id or the URI is malformed", async () => {
    expect((await handle(request(
        `/api/workspaces/${WORKSPACE_ID}/gadgets/not-a-number/call`, {
          method: "POST",
          body: JSON.stringify({ method: "ping" }),
        }, { "content-type": "application/json" }))).status).toBe(400);
    expect((await handle(request(
        `/api/workspaces/%E0%A4%A/gadgets/${GADGET_ID}/call`, {
          method: "POST",
          body: JSON.stringify({ method: "ping" }),
        }, { "content-type": "application/json" }))).status).toBe(400);
  });

  it("returns 404 for a workspace the session is not allowed to open", async () => {
    let response = await handle(callRequest({ method: "ping" }), fakePublicApi({
      openError: createOpenGadgetError(OPEN_GADGET_ERROR_CODES.workspaceAccessDenied),
    }));
    expect(response.status).toBe(404);
  });

  it("calls getGadget with the path workpiece id, not defaultGadgetId", async () => {
    let getGadgetIds: WorkpieceId[] = [];
    let { status, body } = await callJson(callRequest({ method: "ping" }),
        fakePublicApi({ getGadgetIds }));
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, result: "pong" });
    expect(getGadgetIds).toEqual([GADGET_ID]);
  });

  it("invokes only gadget methods, never this.env bindings, so HITL stays in front of connectors",
      async () => {
    let gadget = fixtureGadget();
    let { status, body } = await callJson(callRequest({ method: "echo", args: ["hi", 2] }),
        fakePublicApi({ gadget }));

    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, result: { args: ["hi", 2] } });

    let envCall = await callJson(callRequest({ method: "env" }), fakePublicApi({ gadget }));
    expect(envCall.status).toBe(404);
    expect(envCall.body).toEqual({ ok: false, error: "No such method: env" });

    let bindingCall = await callJson(callRequest({ method: "secretBinding" }),
        fakePublicApi({ gadget }));
    expect(bindingCall.status).toBe(404);
  });

  it("returns method-not-found rather than reflecting into stub or Object.prototype names",
      async () => {
    let gadget = fixtureGadget();
    for (let method of ["missing", "constructor", "__proto__", "toString", "then",
        "dup", "fetch", "connect", "onRpcBroken"]) {
      let { status, body } = await callJson(callRequest({ method }), fakePublicApi({ gadget }));
      expect(status).toBe(404);
      expect(body.ok).toBe(false);
    }
  });

  it("returns 501 when a method would return a capability, including nested stubs",
      async () => {
    class Binding extends RpcTarget {
      send() { return "leaked"; }
    }
    let gadget = fixtureGadget({
      capability() { return new Binding(); },
      nested() { return { env: { dup() { return this; } } }; },
      list() { return [{ dup() { return this; } }]; },
    });

    for (let method of ["capability", "nested", "list"]) {
      let { status, body } = await callJson(callRequest({ method }), fakePublicApi({ gadget }));
      expect(status).toBe(501);
      expect(body).toEqual({ ok: false, error: "HTTP cannot return capabilities." });
    }
  });

  it("returns GET ui as JSON jsCode, not a first-party HTML document", async () => {
    let getGadgetIds: WorkpieceId[] = [];
    let wrapped = await handle(request(UI_PATH), fakePublicApi({
      ui: { jsCode: "window.__gadget = 1;\n" },
      getGadgetIds,
    }));
    expect(wrapped.status).toBe(200);
    expect(wrapped.headers.get("content-type")).toMatch(/application\/json/);
    expect(await wrapped.json()).toEqual({ jsCode: "window.__gadget = 1;\n" });
    expect(getGadgetIds).toEqual([GADGET_ID]);

    // JSON UI does not need POST CSRF: missing Origin is allowed with Bearer.
    let noOrigin = await handle(request(UI_PATH, {}, { origin: "" }), fakePublicApi({
      ui: { jsCode: "ok" },
    }));
    expect(noOrigin.status).toBe(200);
  });

  it("keeps the original connectToGadget failure after dispose", async () => {
    let thrown = await callJson(callRequest({ method: "ping" }), fakePublicApi({
      connectToGadget: () => { throw new Error("facet down"); },
    }));
    expect(thrown.status).toBe(500);
    expect(thrown.body).toEqual({ ok: false, error: "facet down" });

    let nullable = await callJson(callRequest({ method: "ping" }), fakePublicApi({
      connectToGadget: () => null,
    }));
    expect(nullable.status).toBe(500);
    expect(nullable.body).toEqual({ ok: false, error: "Gadget server is not callable." });
  });

  it("caps the POST body even when Content-Length is missing", async () => {
    let oversized = callRequest("x".repeat(65 * 1024), { "content-length": "" });
    let { status, body } = await callJson(oversized);
    expect(status).toBe(413);
    expect(body).toEqual({ ok: false, error: "Payload Too Large" });
  });
});
