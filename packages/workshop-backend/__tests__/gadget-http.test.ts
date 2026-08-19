import { describe, expect, it } from "vitest";
import { RpcTarget } from "capnweb";
import {
  AUTH_ERROR_CODES,
  createAuthError,
  createOpenGadgetError,
  OPEN_GADGET_ERROR_CODES,
  type AuthenticatedApi,
  type GadgetHttpCallResponse,
  type GadgetMetadata,
  type PublicApi,
  type UiBundle,
} from "@gadgets/workshop-shared/api";
import { GADGET_HTTP_UI_CSP, handleGadgetHttpRequest } from "../src/gadget-http.js";

const TOKEN = "alice:session-secret";
const GADGET_ID = "workspace-gadget-1";
const ORIGIN = "https://workshop.example";

type FakeGadget = {
  ping: (value?: unknown) => unknown;
  echo: (...args: unknown[]) => unknown;
  env: { secretBinding: { send: () => never } };
  capability?: () => unknown;
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
  gadgetId?: string;
  ui?: UiBundle | null;
  gadget?: object;
  openError?: Error;
} = {}): Pick<PublicApi, "authenticate"> {
  let expectedToken = options.token ?? TOKEN;
  let expectedGadgetId = options.gadgetId ?? GADGET_ID;
  let gadget = options.gadget ?? fixtureGadget();
  let ui: UiBundle | null = options.ui === undefined ? { jsCode: "export const ready = true;\n" } : options.ui;

  return {
    async authenticate(token: string) {
      if (token !== expectedToken) throw createAuthError(AUTH_ERROR_CODES.invalidSessionToken);
      return {
        async openGadget(id: string) {
          if (options.openError) throw options.openError;
          if (id !== expectedGadgetId) {
            throw createOpenGadgetError(OPEN_GADGET_ERROR_CODES.workspaceNotFound);
          }
          return {
            async getMetadata(): Promise<Pick<GadgetMetadata, "id" | "title" | "defaultGadgetId">> {
              return { id, title: "Fixture", defaultGadgetId: 1 };
            },
            async getGadget() {
              return {
                async getUiBundle() { return ui; },
                async connectToGadget() { return gadget; },
              };
            },
          };
        },
      } as unknown as AuthenticatedApi;
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
  return request(`/api/gadgets/${GADGET_ID}/call`, {
    method: "POST",
    body: JSON.stringify(body),
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
    // Bindings and gadget methods are not ambient: knowing the gadget id is not enough.
    let response = await handle(request(`/api/gadgets/${GADGET_ID}/call`, {
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

  it("returns 403 when Origin is not the request origin so CSRF cannot drive gadget methods", async () => {
    // A third-party page that has the user's cookie or stolen Bearer must still fail the
    // same-origin check before authenticate() or connectToGadget() run.
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

  it("returns 405 for the wrong method on each route", async () => {
    expect((await handle(request(`/api/gadgets/${GADGET_ID}/ui`, { method: "POST" }))).status)
        .toBe(405);
    expect((await handle(request(`/api/gadgets/${GADGET_ID}/call`, { method: "GET" }))).status)
        .toBe(405);
    expect((await handle(callRequest({ method: "ping" }, {}, { method: "PUT" }))).status)
        .toBe(405);
  });

  it("returns 404 for a workspace the session is not allowed to open", async () => {
    let response = await handle(callRequest({ method: "ping" }), fakePublicApi({
      openError: createOpenGadgetError(OPEN_GADGET_ERROR_CODES.workspaceAccessDenied),
    }));
    expect(response.status).toBe(404);
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

  it("returns method-not-found rather than reflecting into constructor or Object.prototype",
      async () => {
    let gadget = fixtureGadget();
    for (let method of ["missing", "constructor", "__proto__", "toString", "then"]) {
      let { status, body } = await callJson(callRequest({ method }), fakePublicApi({ gadget }));
      expect(status).toBe(404);
      expect(body.ok).toBe(false);
    }
  });

  it("returns 501 when a method would return a capability because HTTP cannot carry stubs",
      async () => {
    class Binding extends RpcTarget {
      send() { return "leaked"; }
    }
    let gadget = fixtureGadget({
      capability() { return new Binding(); },
    });

    let { status, body } = await callJson(callRequest({ method: "capability" }),
        fakePublicApi({ gadget }));
    expect(status).toBe(501);
    expect(body).toEqual({ ok: false, error: "HTTP cannot return capabilities." });
  });

  it("serves GET ui as HTML wrapping jsCode, and prefers html when the sibling field is present",
      async () => {
    let wrapped = await handle(request(`/api/gadgets/${GADGET_ID}/ui`), fakePublicApi({
      ui: { jsCode: "window.__gadget = 1;\n" },
    }));
    expect(wrapped.status).toBe(200);
    expect(wrapped.headers.get("content-type")).toMatch(/text\/html/);
    expect(wrapped.headers.get("content-security-policy")).toBe(GADGET_HTTP_UI_CSP);
    let html = await wrapped.text();
    expect(html).toContain(encodeURIComponent("//# sourceURL=client.js\nwindow.__gadget = 1;\n"));
    expect(html).toContain("Authorization: Bearer");

    let staticHtml = await handle(request(`/api/gadgets/${GADGET_ID}/ui`), fakePublicApi({
      ui: { jsCode: "ignored()", html: "<html><body>static</body></html>" } as UiBundle,
    }));
    expect(await staticHtml.text()).toBe("<html><body>static</body></html>");
  });

  it("accepts the session from an authToken cookie, matching the SPA storage key", async () => {
    let { status, body } = await callJson(callRequest({ method: "ping" }, {
      authorization: "",
      cookie: "authToken=" + encodeURIComponent(TOKEN),
    }));
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, result: "pong" });
  });
});
