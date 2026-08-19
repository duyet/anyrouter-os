import { RpcStub, RpcTarget } from "capnweb";
import {
  AUTH_ERROR_CODES,
  getAuthErrorCode,
  getOpenGadgetErrorCode,
  OPEN_GADGET_ERROR_CODES,
  type AuthenticatedApi,
  type GadgetHttpCallRequest,
  type GadgetHttpCallResponse,
  type PublicApi,
  type UiBundle,
  type WorkpieceId,
} from "@gadgets/workshop-shared/api";
import { createWorkshopLogger } from "./observability";

const logger = createWorkshopLogger("workshop.gadget-http");

/** CSP for GET /api/gadgets/:id/ui. connect-src is none: method calls go through POST /call. */
export const GADGET_HTTP_UI_CSP =
    "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; " +
    "img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

const MAX_CALL_BODY_BYTES = 64 * 1024;
const GADGET_HTTP_PATH = /^\/api\/gadgets\/([^/]+)\/(ui|call)$/;
const METHOD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORBIDDEN_METHODS = new Set(["__proto__", "constructor", "prototype", "then"]);

type GadgetHttpAction = "ui" | "call";
type GadgetHttpMatch = { gadgetId: string; action: GadgetHttpAction };

/** PublicApi.authenticate is the session authority for this HTTP surface. */
type GadgetHttpPublicApi = Pick<PublicApi, "authenticate">;

function matchGadgetHttpPath(pathname: string): GadgetHttpMatch | null {
  let match = GADGET_HTTP_PATH.exec(pathname);
  if (!match) return null;
  return { gadgetId: decodeURIComponent(match[1]), action: match[2] as GadgetHttpAction };
}

function sessionTokenFromRequest(request: Request): string | undefined {
  let authorization = request.headers.get("authorization");
  if (authorization) {
    let bearer = /^Bearer\s+(\S+)/i.exec(authorization);
    if (bearer) return bearer[1];
  }
  // Same key the SPA stores in localStorage; accepted so tools can send the session as a cookie.
  let cookie = request.headers.get("cookie");
  if (cookie) {
    let authToken = /(?:^|;\s*)authToken=([^;]+)/.exec(cookie);
    if (authToken) return decodeURIComponent(authToken[1]);
  }
  return undefined;
}

function textResponse(status: number, body: string, extra?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...extra },
  });
}

function jsonResponse(status: number, body: GadgetHttpCallResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function disposeQuietly(value: unknown): void {
  let dispose = (value as { [Symbol.dispose]?: () => void })[Symbol.dispose];
  try {
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
 * cannot be selected here. Object.prototype names are never callable.
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

function isRpcCapability(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "function") return true;
  if (typeof value !== "object") return false;
  if (value instanceof RpcTarget || value instanceof RpcStub) return true;
  return looksLikeRpcStub(value);
}

function htmlFromUiBundle(bundle: UiBundle): string {
  // TODO: Prefer UiBundle.html when the sibling HTML-bundle change lands. Until then the
  // deployed bundle is `{ jsCode }`; wrap it as a document the way the Workshop iframe does.
  let html = (bundle as UiBundle & { html?: unknown }).html;
  if (typeof html === "string" && html.length > 0) return html;

  let src = `data:text/javascript;charset=utf-8,${encodeURIComponent(
      `//# sourceURL=client.js\n${bundle.jsCode}`)}`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${GADGET_HTTP_UI_CSP}">
</head>
<body>
  <!--
    Workshop iframe handshake (postMessage + Cap'n Web) is owned by the SPA.
    This HTTP document is static (connect-src 'none'). Method calls, including anything
    that uses env bindings, go through POST /api/gadgets/:id/call with
    Authorization: Bearer <session token>.
  -->
  <script type="module" src="${src}"></script>
</body>
</html>`;
}

async function readCallRequest(request: Request): Promise<GadgetHttpCallRequest | Response> {
  let declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_CALL_BODY_BYTES) {
    return jsonResponse(413, { ok: false, error: "Payload Too Large" });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON" });
  }
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
    publicApi: GadgetHttpPublicApi, token: string, gadgetId: string) {
  let session: Awaited<ReturnType<PublicApi["authenticate"]>>;
  try {
    session = await publicApi.authenticate(token);
  } catch (error) {
    if (getAuthErrorCode(error) === AUTH_ERROR_CODES.invalidSessionToken) {
      return textResponse(401, "Unauthorized");
    }
    logger.warn("gadget http authenticate failed", {
      event: "gadget.http.authenticate.failed", gadgetId, error,
    });
    return textResponse(401, "Unauthorized");
  }

  let overseer: Awaited<ReturnType<AuthenticatedApi["openGadget"]>>;
  try {
    overseer = await session.openGadget(gadgetId);
  } catch (error) {
    disposeQuietly(session);
    let code = getOpenGadgetErrorCode(error);
    if (code === OPEN_GADGET_ERROR_CODES.workspaceNotFound ||
        code === OPEN_GADGET_ERROR_CODES.workspaceAccessDenied) {
      return textResponse(404, "Not Found");
    }
    logger.warn("gadget http open failed", {
      event: "gadget.http.open.failed", gadgetId, error,
    });
    return textResponse(404, "Not Found");
  }

  try {
    let metadata = await overseer.getMetadata();
    let workpieceId: WorkpieceId | undefined = metadata.defaultGadgetId;
    if (workpieceId === undefined) {
      disposeQuietly(overseer);
      disposeQuietly(session);
      return textResponse(404, "Not Found");
    }
    let gadget = await overseer.getGadget(workpieceId);
    return { session, overseer, gadget };
  } catch (error) {
    disposeQuietly(overseer);
    disposeQuietly(session);
    logger.warn("gadget http gadget resolve failed", {
      event: "gadget.http.gadget.failed", gadgetId, error,
    });
    return textResponse(404, "Not Found");
  }
}

async function serveUi(
    publicApi: GadgetHttpPublicApi, token: string, gadgetId: string): Promise<Response> {
  let resolved = await resolveGadgetClient(publicApi, token, gadgetId);
  if (resolved instanceof Response) return resolved;
  let { session, overseer, gadget } = resolved;
  try {
    let bundle = await gadget.getUiBundle();
    if (!bundle) return textResponse(404, "Not Found");
    return new Response(htmlFromUiBundle(bundle), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": GADGET_HTTP_UI_CSP,
        "x-content-type-options": "nosniff",
      },
    });
  } finally {
    disposeQuietly(gadget);
    disposeQuietly(overseer);
    disposeQuietly(session);
  }
}

async function serveCall(
    request: Request, publicApi: GadgetHttpPublicApi, token: string, gadgetId: string,
    ): Promise<Response> {
  let contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return textResponse(415, "Expected application/json.");
  }

  let body = await readCallRequest(request);
  if (body instanceof Response) return body;

  let resolved = await resolveGadgetClient(publicApi, token, gadgetId);
  if (resolved instanceof Response) return resolved;
  let { session, overseer, gadget: gadgetClient } = resolved;
  let facet: unknown;
  try {
    facet = await gadgetClient.connectToGadget();
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
        event: "gadget.http.call.failed", gadgetId, error,
      });
      return jsonResponse(200, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (isRpcCapability(result)) {
      disposeQuietly(result);
      return jsonResponse(501, { ok: false, error: "HTTP cannot return capabilities." });
    }

    try {
      return jsonResponse(200, { ok: true, result });
    } catch (error) {
      logger.warn("gadget http result not serializable", {
        event: "gadget.http.call.serialize.failed", gadgetId, error,
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
 * Session tokens are the authority (Bearer or `authToken` cookie). Bindings are never
 * exposed: POST /call may invoke gadget methods only.
 *
 * Returns null when the path is not a gadget HTTP route.
 */
export async function handleGadgetHttpRequest(
    request: Request, publicApi: GadgetHttpPublicApi): Promise<Response | null> {
  let url = new URL(request.url);
  let match = matchGadgetHttpPath(url.pathname);
  if (!match) return null;

  if (request.headers.get("origin") !== url.origin) {
    return textResponse(403, "Cross-origin API access not allowed.");
  }

  let allowed = match.action === "ui" ? "GET" : "POST";
  if (request.method !== allowed) {
    return textResponse(405, "Method Not Allowed", { allow: allowed });
  }

  let token = sessionTokenFromRequest(request);
  if (!token) return textResponse(401, "Unauthorized");

  if (match.action === "ui") return serveUi(publicApi, token, match.gadgetId);
  return serveCall(request, publicApi, token, match.gadgetId);
}
