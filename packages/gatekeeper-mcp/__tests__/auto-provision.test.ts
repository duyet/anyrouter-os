import { describe, expect, it } from "vitest";

import { GatekeeperVendor, McpAccount } from "../src/mcp.js";

// Fake `ExecutionContext`/`Env` for a `WorkerEntrypoint`. `describe()` and the early guard clauses
// of `createAccount()` read only `this.env`, never `this.ctx`, so this is enough to exercise them
// without a real Workers runtime.
function vendorEnv(env: Record<string, unknown> = {}): never {
  return env as never;
}

// Fake Durable Object context/storage for `McpAccount`, matching the shape `mcp-shared`'s own
// `account.ts` tests use (see `account-endpoint.test.ts`'s `fakeContext()`).
function fakeAccountContext() {
  const values = new Map<string, unknown>();
  return {
    id: { toString: () => "account-id" },
    storage: {
      kv: {
        get<T>(key: string) { return values.get(key) as T | undefined; },
        put<T>(key: string, value: T) { values.set(key, value); },
        delete(key: string) { values.delete(key); },
      },
    },
  };
}

describe("GatekeeperVendor.describe()", () => {
  it("advertises autoProvisionsAccount when MCP_DEFAULT_ENDPOINT is set", async () => {
    const vendor = new GatekeeperVendor(
      {} as never, vendorEnv({ MCP_DEFAULT_ENDPOINT: "https://anyrouter.dev/api/v1/mcp" }));
    await expect(vendor.describe()).resolves.toMatchObject({ autoProvisionsAccount: true });
  });

  it("does not advertise it when the deployment has no default endpoint", async () => {
    const vendor = new GatekeeperVendor({} as never, vendorEnv({}));
    await expect(vendor.describe()).resolves.toMatchObject({ autoProvisionsAccount: false });
  });
});

describe("GatekeeperVendor.createAccount()", () => {
  it("throws without a configured default endpoint", async () => {
    const vendor = new GatekeeperVendor({} as never, vendorEnv({}));
    await expect(vendor.createAccount({ anyrouterKey: "sk-ar-test" }))
      .rejects.toThrow(/no default MCP endpoint/i);
  });

  it("throws without an AnyRouter key, rather than minting a broken account", async () => {
    const vendor = new GatekeeperVendor(
      {} as never, vendorEnv({ MCP_DEFAULT_ENDPOINT: "https://anyrouter.dev/api/v1/mcp" }));
    await expect(vendor.createAccount()).rejects.toThrow(/no anyrouter key was supplied/i);
    await expect(vendor.createAccount({})).rejects.toThrow(/no anyrouter key was supplied/i);
  });
});

describe("McpAccount.staticToken (via getConnection)", () => {
  it("returns the stored key when the account still names the current default endpoint", async () => {
    const context = fakeAccountContext();
    context.storage.kv.put("server", {
      endpoint: "https://anyrouter.dev/api/v1/mcp",
      serverId: "anyrouter",
      serverName: "AnyRouter",
      provenance: "deployment",
      auth: "token",
    });
    const account = new McpAccount(
      context as never, { MCP_DEFAULT_ENDPOINT: "https://anyrouter.dev/api/v1/mcp" } as never);
    await account.setAnyrouterKey("sk-ar-current");

    await expect(account.getConnection("https://anyrouter.dev/api/v1/mcp"))
      .resolves.toMatchObject({ authorization: "sk-ar-current" });
  });

  it("returns null once the account no longer names the deployment's current default endpoint", async () => {
    // The deployment repointed (or dropped) MCP_DEFAULT_ENDPOINT and nobody has reconnected this
    // account yet. Per McpAccountBase's staticToken contract, a stale account must not receive a
    // bearer minted for a server it no longer points at.
    const context = fakeAccountContext();
    context.storage.kv.put("server", {
      endpoint: "https://old.example/mcp",
      serverId: "old",
      serverName: "AnyRouter",
      provenance: "deployment",
      auth: "token",
    });
    const account = new McpAccount(
      context as never, { MCP_DEFAULT_ENDPOINT: "https://new.example/mcp" } as never);
    await account.setAnyrouterKey("sk-ar-stale");

    const failure = await account.getConnection("https://old.example/mcp").catch(err => err);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).not.toContain("sk-ar-stale");
    expect(failure.message).toMatch(/no preissued token/i);
  });

  it("returns null once the deployment has no default endpoint at all", async () => {
    const context = fakeAccountContext();
    context.storage.kv.put("server", {
      endpoint: "https://anyrouter.dev/api/v1/mcp",
      serverId: "anyrouter",
      serverName: "AnyRouter",
      provenance: "deployment",
      auth: "token",
    });
    const account = new McpAccount(context as never, {} as never);
    await account.setAnyrouterKey("sk-ar-orphaned");

    const failure = await account.getConnection("https://anyrouter.dev/api/v1/mcp").catch(err => err);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toMatch(/no preissued token/i);
  });
});
