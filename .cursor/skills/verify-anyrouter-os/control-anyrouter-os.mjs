#!/usr/bin/env node
/**
 * CLI lever for AnyRouter OS (os.anyrouter.dev).
 *
 * Drives a dedicated Chrome via CDP. Does not add Playwright/Puppeteer to the repo.
 * Invocation examples live in SKILL.md — this file is the harness.
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SKILL_DIR, "../../..");
const ARTIFACTS_DIR = join(SKILL_DIR, "artifacts");
const RUNTIME_DIR = "/tmp/verify-anyrouter-os";
const SESSION_PATH = join(RUNTIME_DIR, "session.json");
const LIVE_ORIGIN = "https://os.anyrouter.dev";
const LOCAL_ORIGIN = "http://localhost:8787";
const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

const CHROME_CANDIDATES = [
  process.env.VERIFY_CHROME,
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/opt/google/chrome/chrome",
  "/usr/local/bin/google-chrome",
].filter(Boolean);

function usage(code = 0) {
  process.stdout.write(`Drive AnyRouter OS over a dedicated Chrome CDP session.

Usage:
  node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs <command> [flags]

Commands:
  doctor [--target live|local] [--json]
      Read-only health check. Live is the production-parity surface.
      Local is BLOCKED unless a gitignored .dev.vars/.env.local exists that
      actually configures Clerk the way wrangler.anyrouter-os.jsonc does.
  launch --target local
      Start pnpm run-local. Refused for --target live (already deployed).
  open [--target live|local] [--url <url>]
      Launch a dedicated Chrome profile and navigate.
  goto <url>
      Navigate the current session.
  wait --text <str> | --selector <css> | --title <str>   [--timeout-ms N]
  click --name <str> | --selector <css> | --role <role> --name <str>
  press --key <Key>
  eval <js> [--json]
  state [--path <file>]
      Dump title, headings, sign-in markers, theme, Clerk iframes.
  snapshot [--aria] [--path <file>]
  screenshot [--path <file>] [--full]
  info
  cleanup
      Kill the Chrome (and optional local server) this session started.
      Does not delete artifacts/.

Global:
  --session <id>     Isolate parallel runs (default: current)
  --help

Evidence survives cleanup under:
  ${ARTIFACTS_DIR}/
`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--json") args.json = true;
    else if (a === "--aria") args.aria = true;
    else if (a === "--full") args.full = true;
    else if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      let key;
      let value;
      if (eq !== -1) {
        key = a.slice(2, eq);
        value = a.slice(eq + 1);
      } else {
        key = a.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          value = next;
          i++;
        } else {
          value = true;
        }
      }
      args[key] = value;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function sessionPaths(sessionId) {
  const id = sessionId || "current";
  const dir = join(RUNTIME_DIR, id);
  return {
    id,
    dir,
    session: join(dir, "session.json"),
    profile: join(dir, "chrome-profile"),
    log: join(dir, "chrome.log"),
    pid: join(dir, "chrome.pid"),
    localPid: join(dir, "local-server.pid"),
  };
}

function readSession(paths) {
  if (!existsSync(paths.session)) {
    throw new Error(
      `No verification session at ${paths.session}. Run: open --target live`,
    );
  }
  return JSON.parse(readFileSync(paths.session, "utf8"));
}

function writeSession(paths, data) {
  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.session, JSON.stringify(data, null, 2) + "\n");
}

function findChrome() {
  for (const bin of CHROME_CANDIDATES) {
    if (existsSync(bin)) return bin;
  }
  throw new Error(
    "No Chrome binary found. Set VERIFY_CHROME to a Chromium/Chrome executable.",
  );
}

function portFree(port) {
  return new Promise((resolveFree) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolveFree(false);
    });
    socket.once("error", () => resolveFree(true));
  });
}

async function pickPort() {
  for (let i = 0; i < 40; i++) {
    const port = 9330 + Math.floor(Math.random() * 400);
    if (await portFree(port)) return port;
  }
  throw new Error("Could not find a free CDP port");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function waitFor(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
      last = value;
    } catch (err) {
      last = err;
    }
    await sleep(200);
  }
  throw new Error(
    `Timed out waiting for ${label}${last instanceof Error ? `: ${last.message}` : ""}`,
  );
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message || JSON.stringify(msg.error)}`));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30_000);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

async function waitForCdpHttp(port, timeoutMs = 20_000) {
  return waitFor(
    async () => {
      try {
        return await fetchJson(`http://127.0.0.1:${port}/json/version`);
      } catch {
        return null;
      }
    },
    timeoutMs,
    `Chrome CDP on :${port}`,
  );
}

async function connectPage(port, timeoutMs = 20_000) {
  const version = await waitForCdpHttp(port, timeoutMs);

  const page = await waitFor(
    async () => {
      const list = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      return (
        list.find(
          (t) =>
            t.type === "page" &&
            t.webSocketDebuggerUrl &&
            !/chrome-extension:/i.test(t.url || ""),
        ) || null
      );
    },
    timeoutMs,
    "Chrome page target",
  );

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP websocket open timed out")), 10_000);
    ws.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    ws.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("CDP websocket failed"));
      },
      { once: true },
    );
  });
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Accessibility.enable").catch(() => {});
  return { cdp, version, page };
}

async function attachSession(paths) {
  const session = readSession(paths);
  const { cdp } = await connectPage(session.port, 8_000);
  return { session, cdp };
}

async function evaluate(cdp, expression, awaitPromise = true) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise,
  });
  if (result.exceptionDetails) {
    const text =
      result.exceptionDetails.exception?.description ||
      result.exceptionDetails.text ||
      "Runtime.evaluate failed";
    throw new Error(text);
  }
  return result.result?.value;
}

function originFor(target) {
  if (target === "local") return LOCAL_ORIGIN;
  return LIVE_ORIGIN;
}

function envFileExists() {
  return (
    existsSync(join(REPO_ROOT, ".env.local")) ||
    existsSync(join(REPO_ROOT, ".dev.vars"))
  );
}

function localWranglerHasClerk() {
  try {
    const wrangler = readFileSync(
      join(REPO_ROOT, "packages/workshop-backend/wrangler.jsonc"),
      "utf8",
    );
    return /CLERK_PUBLISHABLE_KEY/.test(wrangler);
  } catch {
    return false;
  }
}

async function httpProbe(url) {
  const started = Date.now();
  const res = await fetch(url, { redirect: "follow" });
  const body = await res.text();
  return {
    url,
    status: res.status,
    ms: Date.now() - started,
    title: (body.match(/<title>([^<]+)<\/title>/i) || [, ""])[1],
    hasRoot: body.includes('id="root"'),
    hasAnyRouter: /AnyRouter OS/.test(body),
  };
}

async function cmdDoctor(args) {
  const target = args.target || "live";
  const chrome = (() => {
    try {
      return findChrome();
    } catch (err) {
      return { error: err.message };
    }
  })();
  const sessionExists = existsSync(sessionPaths(args.session).session);

  const report = {
    ok: false,
    target,
    chrome: typeof chrome === "string" ? chrome : null,
    chromeError: chrome?.error || null,
    session: sessionExists,
    live: null,
    local: null,
    blocked: null,
  };

  if (target === "live" || target === "all") {
    try {
      report.live = await httpProbe(LIVE_ORIGIN);
    } catch (err) {
      report.live = { error: err.message };
    }
  }

  const envPresent = envFileExists();
  const clerkInLocalWrangler = localWranglerHasClerk();
  const localListening = !(await portFree(8787));
  report.local = {
    origin: LOCAL_ORIGIN,
    listening: localListening,
    envFilePresent: envPresent,
    clerkInLocalWrangler,
    productionParity: false,
  };

  if (target === "local") {
    // Production os.anyrouter.dev is Clerk-only (wrangler.anyrouter-os.jsonc +
    // CLERK_SECRET_KEY secret). Local wrangler.jsonc has neither, and this
    // checkout has no .dev.vars/.env.local. Do not invent those files.
    report.blocked = {
      reason: "local-not-production-parity",
      detail:
        "packages/workshop-backend/wrangler.jsonc has no CLERK_PUBLISHABLE_KEY; " +
        "no .dev.vars or .env.local in the checkout. Local run-local is password-auth, " +
        "not the Clerk landing at https://os.anyrouter.dev. Drive --target live.",
    };
    report.ok = false;
  } else {
    const liveOk =
      report.live &&
      report.live.status === 200 &&
      report.live.hasAnyRouter &&
      report.live.hasRoot &&
      typeof chrome === "string";
    report.ok = !!liveOk;
    if (!liveOk && !report.blocked) {
      report.blocked = {
        reason: "live-unhealthy",
        detail: report.live?.error || `live status ${report.live?.status}`,
      };
    }
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const lines = [
      `target: ${target}`,
      `ok: ${report.ok}`,
      `chrome: ${report.chrome || report.chromeError}`,
      `session: ${sessionExists ? "yes" : "no"}`,
    ];
    if (report.live) {
      lines.push(
        `live: ${report.live.status || "error"} ${report.live.title || report.live.error || ""} (${report.live.ms ?? "?"}ms)`,
      );
    }
    lines.push(
      `local: listening=${report.local.listening} envFile=${report.local.envFilePresent} clerkInWrangler=${report.local.clerkInLocalWrangler}`,
    );
    if (report.blocked) {
      lines.push(`BLOCKED: ${report.blocked.reason}`);
      lines.push(report.blocked.detail);
    }
    process.stdout.write(lines.join("\n") + "\n");
  }
  process.exit(report.ok ? 0 : 2);
}

async function cmdLaunch(args) {
  const target = args.target || "local";
  if (target !== "local") {
    throw new Error(
      "launch is only for --target local. Live is already running at https://os.anyrouter.dev",
    );
  }
  if (!envFileExists() && !localWranglerHasClerk()) {
    throw new Error(
      "Refusing to launch local: no .dev.vars/.env.local and local wrangler.jsonc is not Clerk-configured. " +
        "That instance would not match os.anyrouter.dev. Use open --target live.",
    );
  }
  const paths = sessionPaths(args.session);
  mkdirSync(paths.dir, { recursive: true });
  const child = spawn("pnpm", ["run-local"], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  writeFileSync(paths.localPid, String(child.pid));
  child.unref();
  process.stdout.write(`started pnpm run-local pid=${child.pid}\nwaiting for ${LOCAL_ORIGIN}\n`);
  await waitFor(async () => {
    try {
      const probe = await httpProbe(LOCAL_ORIGIN);
      return probe.status === 200 ? probe : null;
    } catch {
      return null;
    }
  }, 180_000, LOCAL_ORIGIN);
  process.stdout.write(`ready ${LOCAL_ORIGIN}\n`);
}

async function launchChrome(paths) {
  if (existsSync(paths.session)) {
    const existing = JSON.parse(readFileSync(paths.session, "utf8"));
    if (existing.pid && !await portFree(existing.port)) {
      throw new Error(
        `A verification Chrome is already running (pid ${existing.pid} port ${existing.port}). ` +
          `Drive that session, or run cleanup first. Refusing to double-drive.`,
      );
    }
  }
  const chrome = findChrome();
  const port = await pickPort();
  mkdirSync(paths.profile, { recursive: true });
  const logFd = openSync(paths.log, "a");
  const child = spawn(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      "--remote-allow-origins=*",
      `--user-data-dir=${paths.profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-translate",
      "--disable-default-apps",
      "--disable-popup-blocking",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-component-update",
      "--mute-audio",
      "--no-sandbox",
      `--window-size=${DEFAULT_VIEWPORT.width},${DEFAULT_VIEWPORT.height}`,
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: ["ignore", logFd, logFd], detached: true },
  );
  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.pid, String(child.pid));
  child.unref();
  // Probe HTTP only — holding a CDP websocket here blocks the later attach.
  await waitForCdpHttp(port);
  return { pid: child.pid, port, chrome };
}

async function cmdOpen(args) {
  const target = args.target || "live";
  const origin = originFor(target);
  const url = args.url || args._[1] || `${origin}/`;
  if (target === "local") {
    const listening = !(await portFree(8787));
    if (!listening) {
      throw new Error(
        "localhost:8787 is not up. Local production-parity launch is blocked without Clerk env. Use --target live.",
      );
    }
  }
  const paths = sessionPaths(args.session);
  const launched = await launchChrome(paths);
  writeSession(paths, {
    pid: launched.pid,
    port: launched.port,
    chrome: launched.chrome,
    target,
    origin,
    userDataDir: paths.profile,
    startedAt: new Date().toISOString(),
  });
  const { cdp } = await connectPage(launched.port);
  try {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: DEFAULT_VIEWPORT.width,
      height: DEFAULT_VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate(cdp, url);
  } finally {
    cdp.close();
  }
  process.stdout.write(`open ${url}\ncdp :${launched.port} pid ${launched.pid}\n`);
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await cdp.send("Page.enable");
  await waitFor(async () => {
    const ready = await evaluate(cdp, "document.readyState");
    return ready === "complete" ? ready : null;
  }, 30_000, `load ${url}`);
}

async function cmdGoto(args) {
  const url = args._[1];
  if (!url) throw new Error("goto requires a URL");
  const paths = sessionPaths(args.session);
  const { cdp } = await attachSession(paths);
  await navigate(cdp, url);
  const href = await evaluate(cdp, "location.href");
  cdp.close();
  process.stdout.write(`${href}\n`);
}

function waitPredicate(args) {
  if (args.text) {
    const needle = JSON.stringify(args.text);
    return {
      label: `text ${args.text}`,
      expr: `document.body && document.body.innerText.includes(${needle})`,
    };
  }
  if (args.title) {
    const needle = JSON.stringify(args.title);
    return {
      label: `title ${args.title}`,
      expr: `document.title.includes(${needle})`,
    };
  }
  if (args.selector) {
    const sel = JSON.stringify(args.selector);
    return {
      label: `selector ${args.selector}`,
      expr: `!!document.querySelector(${sel})`,
    };
  }
  throw new Error("wait requires --text, --selector, or --title");
}

async function cmdWait(args) {
  const { label, expr } = waitPredicate(args);
  const timeout = Number(args["timeout-ms"] || 30_000);
  const paths = sessionPaths(args.session);
  const { cdp } = await attachSession(paths);
  await waitFor(async () => {
    const ok = await evaluate(cdp, expr);
    return ok ? true : null;
  }, timeout, label);
  cdp.close();
  process.stdout.write(`ok ${label}\n`);
}

const FIND_EL = `
(function(opts) {
  const name = (opts.name || "").trim().toLowerCase();
  const role = (opts.role || "").trim().toLowerCase();
  const selector = opts.selector;
  if (selector) return document.querySelector(selector);
  const nodes = [...document.querySelectorAll("a, button, [role], input, textarea, [aria-label]")];
  const match = nodes.find((el) => {
    if (el.closest("[aria-hidden='true']")) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const elRole = (el.getAttribute("role") || el.tagName.toLowerCase());
    const normalizedRole = el.tagName === "A" ? "link" : el.tagName === "BUTTON" ? "button" : elRole;
    if (role && normalizedRole !== role && elRole !== role) return false;
    const label = (
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.innerText ||
      el.textContent ||
      ""
    ).replace(/\\s+/g, " ").trim().toLowerCase();
    if (!name) return true;
    return label === name || label.startsWith(name) || label.includes(name);
  });
  return match || null;
})
`;

async function cmdClick(args) {
  const paths = sessionPaths(args.session);
  const { cdp } = await attachSession(paths);
  const opts = {
    name: args.name || "",
    role: args.role || "",
    selector: args.selector || "",
  };
  const found = await evaluate(
    cdp,
    `(${FIND_EL})(${JSON.stringify(opts)}) ? true : false`,
  );
  if (!found) {
    cdp.close();
    throw new Error(
      `No clickable match for ${JSON.stringify(opts)}. Run snapshot --aria.`,
    );
  }
  await evaluate(
    cdp,
    `(() => { const el = (${FIND_EL})(${JSON.stringify(opts)}); el.click(); el.focus(); return true; })()`,
  );
  cdp.close();
  process.stdout.write(`clicked ${args.selector || args.role || ""} ${args.name || ""}\n`.trim() + "\n");
}

async function cmdPress(args) {
  const key = args.key;
  if (!key) throw new Error("press requires --key");
  const paths = sessionPaths(args.session);
  const { cdp } = await attachSession(paths);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key });
  cdp.close();
  process.stdout.write(`pressed ${key}\n`);
}

async function cmdEval(args) {
  const expr = args._.slice(1).join(" ");
  if (!expr) throw new Error("eval requires a JS expression");
  const paths = sessionPaths(args.session);
  const { cdp } = await attachSession(paths);
  const value = await evaluate(cdp, expr);
  cdp.close();
  if (args.json || (value && typeof value === "object")) {
    process.stdout.write(JSON.stringify(value, null, 2) + "\n");
  } else {
    process.stdout.write(String(value) + "\n");
  }
}

const STATE_EXPR = `(() => {
  const iframes = [...document.querySelectorAll("iframe")].map((f) => ({
    src: f.src || "",
    title: f.title || f.getAttribute("name") || "",
  }));
  const buttons = [...document.querySelectorAll("button, a")].map((el) => ({
    tag: el.tagName.toLowerCase(),
    name: (el.getAttribute("aria-label") || el.innerText || "").replace(/\\s+/g, " ").trim(),
    href: el.getAttribute("href") || undefined,
  })).filter((b) => b.name).slice(0, 40);
  return {
    href: location.href,
    hash: location.hash,
    title: document.title,
    dataMode: document.documentElement.getAttribute("data-mode"),
    h1: [...document.querySelectorAll("h1")].map((h) => h.innerText.trim()),
    h2: [...document.querySelectorAll("h2")].map((h) => h.innerText.trim()),
    siteName: (document.querySelector("header a span") || {}).innerText || null,
    hasSignInCard: !!document.getElementById("sign-in"),
    hasLoading: (document.body.innerText || "").includes("Loading…"),
    clerkReady:
      (document.body.innerText || "").includes("Continue with GitHub") ||
      (document.body.innerText || "").includes("Secured by Clerk"),
    clerkIframes: iframes.filter((f) => /clerk\\.anyrouter\\.dev|accounts\\.anyrouter\\.dev/.test(f.src)),
    iframes,
    themeButton: (document.querySelector('button[aria-label^="Theme:"]') || {}).getAttribute?.("aria-label") || null,
    primaryNav: [...document.querySelectorAll('nav[aria-label="Primary"] a')].map((a) => ({
      text: a.innerText.trim(),
      href: a.getAttribute("href"),
    })),
    buttons,
  };
})()`;

function artifactPath(p) {
  if (!p) return null;
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

function writeArtifact(path, contents, encoding = "utf8") {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, encoding);
}

async function cmdState(args) {
  const paths = sessionPaths(args.session);
  const { cdp } = await attachSession(paths);
  const value = await evaluate(cdp, STATE_EXPR);
  cdp.close();
  const json = JSON.stringify(value, null, 2) + "\n";
  if (args.path) {
    const out = artifactPath(args.path);
    writeArtifact(out, json);
    process.stdout.write(`wrote ${out}\n`);
  } else {
    process.stdout.write(json);
  }
}

function flattenAx(nodes) {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const lines = [];
  function walk(id, depth) {
    const n = byId.get(id);
    if (!n) return;
    const ignored = n.ignored;
    const role = n.role?.value || "";
    const name = n.name?.value || "";
    if (!ignored && (role || name)) {
      lines.push(`${"  ".repeat(depth)}${role}${name ? `: ${name}` : ""}`);
    }
    for (const child of n.childIds || []) walk(child, ignored ? depth : depth + 1);
  }
  if (nodes[0]) walk(nodes[0].nodeId, 0);
  return lines.join("\n") + "\n";
}

async function cmdSnapshot(args) {
  const paths = sessionPaths(args.session);
  const { cdp } = await attachSession(paths);
  let out;
  if (args.aria) {
    const tree = await cdp.send("Accessibility.getFullAXTree");
    out = flattenAx(tree.nodes || []);
  } else {
    const html = await evaluate(cdp, "document.documentElement.outerHTML");
    out = html;
  }
  cdp.close();
  if (args.path) {
    const dest = artifactPath(args.path);
    writeArtifact(dest, out);
    process.stdout.write(`wrote ${dest}\n`);
  } else {
    process.stdout.write(out);
  }
}

async function cmdScreenshot(args) {
  const paths = sessionPaths(args.session);
  const dest =
    artifactPath(args.path) ||
    join(ARTIFACTS_DIR, `screenshot-${Date.now()}.png`);
  const { cdp } = await attachSession(paths);
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: !!args.full,
  });
  cdp.close();
  writeArtifact(dest, Buffer.from(shot.data, "base64"));
  process.stdout.write(`wrote ${dest}\n`);
}

async function cmdInfo(args) {
  const paths = sessionPaths(args.session);
  const session = readSession(paths);
  const { cdp } = await connectPage(session.port, 8_000);
  const href = await evaluate(cdp, "location.href");
  const title = await evaluate(cdp, "document.title");
  cdp.close();
  process.stdout.write(
    JSON.stringify({ ...session, href, title }, null, 2) + "\n",
  );
}

function killPid(pid) {
  if (!pid) return;
  try {
    process.kill(pid, 0);
  } catch {
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
}

async function cmdCleanup(args) {
  const paths = sessionPaths(args.session);
  let session = null;
  if (existsSync(paths.session)) {
    session = JSON.parse(readFileSync(paths.session, "utf8"));
  }
  const pids = [];
  if (session?.pid) pids.push(session.pid);
  if (existsSync(paths.pid)) pids.push(Number(readFileSync(paths.pid, "utf8")));
  if (existsSync(paths.localPid)) pids.push(Number(readFileSync(paths.localPid, "utf8")));
  for (const pid of pids) {
    killPid(pid);
    // child process groups: chrome may spawn helpers with the same pgid
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      // ignore if not a group leader
    }
  }
  await sleep(400);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // ignore
    }
  }
  if (existsSync(paths.dir)) {
    rmSync(paths.dir, { recursive: true, force: true });
  }
  process.stdout.write(
    `cleaned session ${paths.id}\nartifacts kept at ${ARTIFACTS_DIR}\n`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) usage(args.help ? 0 : 1);
  const cmd = args._[0];
  try {
    switch (cmd) {
      case "doctor":
        await cmdDoctor(args);
        break;
      case "launch":
        await cmdLaunch(args);
        break;
      case "open":
        await cmdOpen(args);
        break;
      case "goto":
        await cmdGoto(args);
        break;
      case "wait":
        await cmdWait(args);
        break;
      case "click":
        await cmdClick(args);
        break;
      case "press":
        await cmdPress(args);
        break;
      case "eval":
        await cmdEval(args);
        break;
      case "state":
        await cmdState(args);
        break;
      case "snapshot":
        await cmdSnapshot(args);
        break;
      case "screenshot":
        await cmdScreenshot(args);
        break;
      case "info":
        await cmdInfo(args);
        break;
      case "cleanup":
        await cmdCleanup(args);
        break;
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(1);
  }
}

await main();
