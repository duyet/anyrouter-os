# Multi-tenancy: state inventory, gap audit, and target model

*Design document. Nothing here is implemented. Every claim below was read out of the tree at
the time of writing and carries a `file:line`; anything not verified is marked **unverified**.*

## Summary

The system is **already multi-tenant, and mostly structurally so**. Tenancy is not a layer that
needs to be added — it is the `UserDurableObject`, keyed by a verified identity, holding the
user's credentials, connected accounts, blueprint library, and AnyRouter grant in its own SQLite
storage. Four separate audits of DO addressing, storage keys, the gadget sandbox, and the
credential paths found **no exploitable cross-tenant read or write** on the main flows.

What is not airtight is narrower and specific:

* one binding (`AVATARS`) keyed on an identifier the caller supplies, with no check at all;
* one deployment-global DO namespace (`EmailAddress`) with no tenant prefix and permanent claims;
* two latent paths (gatekeeper sign-in, the external message gateway) that are safe today only
  because no deployment in this repo enables them;
* a set of authorization checks that are correct but are *conventions* rather than structure —
  they hold because every current call site remembers to make them.

The rest of this document inventories the state, states the concrete attack for each gap, defines
the target model, and sequences the work.

### Tension with the stated goal

The ask was "isolated for each user and never overlap between them." The product deliberately
overlaps users in four places: workspace collaborators, share links, blueprint bearer ids, and
public context collections. Absolute non-overlap deletes those features.

The recommendation is therefore **no *unintended* overlap: every crossing is named, deliberate,
and revocable** — plus, for deployments that do want the literal ask, a **strict-isolation mode**.
That mode is not a new mechanism: `prohibitAllSharing` already exists per workspace
(`packages/workshop-backend/src/overseer.ts:6462`) and is honored on every access path. Lifting it
to a deployment-level `AdminConfig` flag reuses the mechanism instead of inventing a parallel one.

---

## 1. Inventory

Classification: **per-user** (keyed by the tenant), **per-workspace** (keyed by an Overseer DO,
which has exactly one owner but possibly several collaborators), **per-deployment** (shared by
everyone), **ambiguous** (needs a decision).

### 1.1 Durable Objects

| DO | Addressed by | Provenance | Scope |
|---|---|---|---|
| `UserDurableObject` | `idFromName(email)` / `idFromName(username)` | verified Clerk email (`server.ts:696`), gatekeeper-verified email (`auth/login-flow.ts:110`), or a session-token prefix authenticated against that same DO (`server.ts:676-677`) | **per-user** |
| `OverseerDurableObject` | `idFromString(workspaceId)` (`server.ts:219`), `newUniqueId()` on create (`server.ts:280`, `:442`) | client-supplied id, but authorization is inside `open()` | **per-workspace** |
| `AdminSettings` | `getByName("")` | constant singleton (`admin-settings.ts:52`) | **per-deployment** |
| `PendingLogin` | `newUniqueId()`, id never exposed (`server.ts:657`) | server-minted | per-login-attempt |
| `LanguageModelGatekeeper` | props carry `AiModelConfig` incl. `apiToken` (`ai-models.ts:141-149`) | server-minted per session | **per-user credential** |
| `AgentSpawnerGatekeeper` | props `{overseerId, config, creatorUserId}` (`overseer.ts:7598-7602`) | server-minted | per-workspace binding, **carries a user identity** |
| `ContextCollection` / `UserLibrary` / `LibraryRegistry` | `domainName(sharingDomain, id)`, NUL-separated (`gatekeeper-context/src/domain.ts:11-13`) | `sharingDomain` from binding props only; `accountId` a server-minted UUID (`library-gatekeeper.ts:419`) | per-account, per-domain |
| `ScheduleDriver` | `getByName(ctx.props.accountId)` (`gatekeeper-scheduler/src/scheduler.ts:224`) | server-minted UUID | per-account |
| gatekeeper `UserAccount` / `McpAccount` DOs | `newUniqueId()` at mint, `idFromString(ctx.props.…)` thereafter | server-minted, capability URLs | per-connection |
| `EmailAddress` | `getByName(localPart)` (`gatekeeper-email/src/email.ts:202`) | **derived from a user-supplied address** | **per-deployment namespace — gap, see 2.2** |

`idFromName` on a client-supplied string is not by itself a bug here. `server.ts:676` names the DO
from the token prefix but then validates the secret *against that DO* — a forged prefix reaches a
DO that does not hold the attacker's secret. `server.ts:219` opens a stub from a client-supplied
workspace id, but the stub is inert until `open()` resolves the caller's role
(`overseer.ts:6485-6489`) and throws `workspaceAccessDenied` with no metadata leaked.

### 1.2 KV, R2, and other bindings

**`BLUEPRINTS` KV.** Key is the blueprint id only; ownership lives in the value as
`BlueprintKvRecord.ownerId` (`blueprint-archive.ts:26-34`). Every writer uses either a
128-bit CSPRNG id (`blueprint-archive.ts:143-147`) or a compile-time literal — **no client-supplied
string ever becomes a KV key**. Mutating paths check ownership (`user.ts:869-871`). Reads are
deliberately unchecked: a blueprint id is a bearer capability
(`overseer.ts:5753-5755`). Reserved keys `.featured` / `.adminConfig` are guarded by
`isReservedBlueprintKey` (`blueprint-archive.ts:37-39`) and cannot collide anyway, since generated
ids are hex and cannot start with `.`. **Scope: per-user ownership over a per-deployment
namespace, held by unguessable ids.** No `.list()` exists on any of these bindings, which is what
makes the capability model hold rather than being a speed bump.

**`AVATARS` KV.** Key is the user's login name — email or username (`server.ts:176-180`). The
write re-derives the key from the session. The read takes it from the caller
(`server.ts:183-187`). **Ambiguous — see 2.1.**

**`BLUEPRINT_CONTENT` R2.** Three key shapes: `${blueprintId}/${version}`,
`screenshots/${blueprintId}`, and the admin-owned `.site-logo` (`site-logo.ts:10`). No key
contains a user id; isolation is the unguessable `blueprintId` plus the KV-side owner check.
The `screenshots/` read is unauthenticated (`server.ts:812-814` → `:599-600`) and contained only
by the fixed prefix — R2 has no traversal semantics, and the reserved keys live in KV, not R2.

**`LOADER` (gadget sandbox).** Isolate key is
`` `${this.ctx.id}.${codeVersion}.${gadgetId}` `` (`overseer.ts:2356-2365`) — the Overseer DO id,
so **per-workspace and never attacker-chosen**. `getEnvForLoader` (`overseer.ts:2130-2138`) puts
**no raw KV namespace, R2 bucket, DO namespace, or secret into the gadget env** — every entry is a
`ServiceStub` to a `GatekeeperLoopback` whose props (`overseer.ts:2115-2121`) are minted
server-side and resolve back to the same Overseer by id. `globalOutbound: null` is set on all
three loaded workers (`overseer.ts:2400`, `:5419`, `:145`), so gadget code cannot reach the public
internet, the workshop's own API, or localhost except through an explicit gatekeeper binding.
This is the best-isolated part of the system.

**`BROWSER` / PDF export.** `launch()` per call (`browser-export.ts:251`), request interception
aborts everything but the gadget's own bundle (`:290-306`), CSP `default-src 'none'`, browser
closed on every exit path. Output is streamed, never stored — no key, no URL. The page receives
the gadget's own facet, not credentials. Residual, documented in-tree at `browser-export.ts:26-28`:
CSP and interception do not cover WebRTC/STUN.

**Chat attachments.** Bytes live in the Overseer's own SQLite (`overseer.ts:989`), keyed by a
server-generated `crypto.randomUUID()` (`overseer.ts:8043-8069`); client-supplied ids pass a strict
UUID regex (`overseer.ts:467-470`). Reads check the attachment belongs to the named chat
(`overseer.ts:8074-8080`) but not that the caller is entitled to that chat — the authorization is
inherited from holding the facet, and `UseOverseerInterface` does not define the method at all.
**Scope: per-workspace.** Staged (not yet committed) attachments carry no uploader field, so
within a workspace they rely on UUID secrecy alone.

**Feature flags** — per-user evaluation of per-deployment config, identity taken from the session
(`server.ts:209`), no state. **Analytics** — per-deployment write-only pipeline that records
`user_id` *and* `gadget_owner_user_id` on the same row (`analytics.ts:33-83`); no read path exists
anywhere in the codebase, so it is operator-visible only. **DO telemetry** — logs raw DO ids
(`do-telemetry.ts:52-57`), operator-visible only. **`FRONTEND_ERROR_RATE_LIMITER`** — **shared per
source IP**, with a literal `"unknown"` bucket for callers lacking the header
(`client-errors.ts:108-124`); availability only.

**`packages/router`** — **per-deployment, no state.** It is the trust boundary that decides which
requests reach which worker: `/api/*` and `/blueprint-screenshot/*` to the backend,
`/gatekeeper/<name>/*` to whichever gatekeepers are bound, discovered by scanning its own
`GATEKEEPER_*` service bindings. It derives no DO ids and carries no tenant identity.

### 1.3 Credentials and connected accounts

Connected accounts are stored as **capabilities, not tokens**: `ConnectedAccountRecord.account` is
a `Fetcher<GatekeeperUser>` (`user.ts:19-30`) in the user DO's own collection, with dense per-DO
integer ids. There is no global account table, so an `accountId` is **not a cross-tenant
identifier at all** — the strongest isolation property found. Provider OAuth tokens live in the
gatekeeper's own per-connection DO (`gatekeeper-github/src/github.ts:1108-1109`), never in the user
DO. `getGatekeeperClassFor` (`user.ts:1485-1511`) resolves DO-locally and is the single chokepoint
where admin-disabled gatekeepers are enforced. The AnyRouter grant is the one raw secret in the
user DO (`user.ts:189-193`); it is resolved only in `#resolveModelConfig` (`user.ts:567-579`),
reachable only from `getChatContext`, which is marked *DO NOT MAKE PUBLIC* and appears in no
public API surface. There is **no shared deployment-level AnyRouter key** — `ai-models.ts:112-115`
says so and grep confirms it.

Admin is `env.ADMINS` membership, checked once when the capability is minted
(`server.ts:102-119`, `:588-595`). No admin method enumerates users or reads another user's
accounts or tokens; the blast radius is deployment config and denial, not user data. Username and
email namespaces are disjoint (`normalizeUsername`, `user.ts:1584-1592`, rejects `@`), so a
gatekeeper-asserted identity cannot collide with an `ADMINS` entry.

### 1.4 Sharing — where the intended boundary sits

Four deliberate crossings, and this is the line:

1. **Collaborators.** A whole workspace — code, storage, chat history, bindings — shared with a
   named account at role `build` or `use`. Identified by profile id, not a token. Role escalation
   is refused (`sharing.ts:300-303`); roles never silently downgrade (`:317-320`).
2. **Share links.** Bearer capabilities, 128 bits of CSPRNG (`sharing.ts:476-481`), stored only as
   an HMAC hash, revocable per link across all its copies (`sharing.ts:219-273`).
3. **Blueprints.** A code snapshot plus binding *descriptors*. Explicitly a bearer capability
   (`overseer.ts:5753-5755`). Importing carries **no** credentials: `snapshotCode`
   (`overseer.ts:5051-5074`) copies files only; `collectBindingMetadata` emits the vendor's URL
   *pattern*, not the resource; the importer wires bindings through their own accounts.
4. **Public context collections.** Admin-created, readable by everyone, by design.

`sharingDomain` is **not** a security boundary and says so (`gatekeeper-context/src/domain.ts:1-5`):
it prevents accidental mixing between trusted deployments sharing one gatekeeper instance. It
arrives only as a binding prop (`library-gatekeeper.ts:387-391`, populated from `$PUBLIC_BASE_URL`
at `scripts/release/manifest-lib.mjs:199-202`); the one place it is an argument immediately pins it
against the prop (`library-gatekeeper.ts:206-215`), so a caller-supplied domain can only ever fail.

**The boundary:** a user's identity, credentials, connected accounts, library, and billing never
cross. Workspace *content* crosses only along an explicit edge the owner created, recomputed live
at every `open()`. Everything else is a gap.

---

## 2. Gaps

Each is a concrete path. Findings without one were dropped.

### 2.1 `getAvatar` reads on a caller-supplied identifier with no check — Medium

`packages/workshop-backend/src/server.ts:183-187`:

```ts
async getAvatar(userId: string): Promise<Uint8Array | null> {
  let result = await this.env.AVATARS.get(userId, "arrayBuffer");
```

The key *is* the user's email (or username). `AiChatAuthorInfo.id` is that same email
(`user.ts:308-312`), so the frontend already holds other users' key material by design.

**Attack.** Any authenticated user calls `getAvatar("someone@example.com")` for any address they
can guess. They get the bytes, and — because an unset key returns `null` — an **account-existence
oracle keyed on email address**. There is no `list()`, so this requires guessing addresses, but a
targeted check ("does person X have an account on this deployment?") is one call.

The byte disclosure is plausibly intended (avatars are shown for collaborators). The enumeration
property is what needs a decision, and there is no comment either way at the call site.

### 2.2 `EmailAddress` is a deployment-global DO namespace with permanent claims — Medium

`packages/gatekeeper-email/src/email.ts:202`: `ctx.exports.EmailAddress.getByName(emailName)`,
where `emailName` is the local-part of a user-supplied address. No tenant prefix. Ownership is
first-come, checked inside the DO (`email.ts:626-636`), and claims are **never released** —
`email.ts:445` says so explicitly.

**Attack.** Any user claims any unclaimed local-part, permanently, including ones another tenant
will predictably want (`support`, `billing`, a competitor's brand). No cross-tenant read, but a
squatting and denial primitive with no recovery path. This is the one place in the tree where a DO
name is derived from user input without a tenant component in front of it.

### 2.3 Gatekeeper sign-in: the login attempt is not bound to the browser that started it — High, latent

`server.ts:645-666` puts `startGatekeeperLogin(vendorId)` on `PublicApiImpl` — the
**unauthenticated** surface. It returns `{url, attempt}`, where `attempt` wraps the `PendingLogin`
DO. On completion, `auth/login-flow.ts:112-124` mints a session token for whichever email the
gatekeeper verified and calls `pending.deliver(token)`, which resolves **every** registered waiter
(`login-flow.ts:64-71`).

**Attack.** An unauthenticated attacker calls `startGatekeeperLogin("google")`, holds
`attempt.wait()` open, and sends the returned `url` to a victim. The victim sees a genuine
`accounts.google.com` consent screen on the deployment's own domain chain and approves. The
callback mints a session for *the victim* and delivers it to *the attacker's* waiting call. The
attacker now holds a full session as the victim, and the session row is indistinguishable from a
legitimate login.

The comment at `server.ts:616-619` argues the design is safe because the client awaits through a
capability rather than a guessable id. That defends against a third party *guessing* the
rendezvous. It does not defend against the party who legitimately holds the stub not being the
party who authenticated.

**Latent, not live.** `startGatekeeperLogin` throws unless `vendorId` is in `AUTH_GATEKEEPERS`,
which is off by default (`auth/config.ts`) and is set in **no** wrangler config or deploy file in
this repo — the shipped `anyrouter-os` deployment uses Clerk
(`packages/workshop-backend/wrangler.anyrouter-os.jsonc:47`), which is unaffected because
`loginWithClerk` verifies a token the caller already holds. But `docs/public-server.md:29` and
three gatekeeper READMEs document turning it on, so any deployment that follows the docs is
exposed.

**Label it honestly:** this is an authentication-flow hijack, not an isolation-model bug. Different
fix class, and it sequences separately.

### 2.4 The external message gateway asserts the caller's identity as plain data — High, latent

`packages/workshop-backend/src/external-message-gateway.ts:29-31` routes to
`OverseerDurableObject.getByName(`${source}:${input.gadgetKey}`)` and forwards
`input.callerEmail`. `overseer.ts:6550` then does `this.impl.users.getByName(input.callerEmail)`
— an ordinary RPC field is the **sole** basis for identity. On a workspace that does not exist yet,
that identity becomes the owner (`overseer.ts:6561-6570`). Existing workspaces are role-checked
(`:6572-6586`), so this is not an arbitrary-read primitive.

The whole trust boundary is therefore the holder of the `ExternalMessageGateway` binding. **There
is no in-repo caller and no wrangler config binds it** — grep across `packages/`, `deploy/`, and
`scripts/` returns nothing. So it is latent, and whether it is safe depends entirely on an
out-of-repo integration verifying emails: **unverified**.

Secondary: `${source}:${gadgetKey}` uses `:` as a separator and does not reject `:` inside
`gadgetKey`, so `sourceA` + `"b:x"` collides with `sourceB` + `"x"`. Reachable only across two
mutually distrusting gateway bindings.

### 2.5 Authorization that is convention, not structure — Medium

Two checks are correct at every current call site and have nothing preventing the next call site
from omitting them.

* **`open()`-only authorization.** `docs/sharing.md` is candid: a session already open is not
  re-checked per message. The compensating control is `scheduleRevocationRestart()`
  (`overseer.ts:3280`), called from exactly three places (`:7425`, `:8751`, `:8770`), which syncs
  storage and aborts the DO ~100 ms later. **Any future path that severs access without calling it
  leaves live sessions fully authorized.**
* **`#inScopeGatekeepers(role)`** (`overseer.ts:5898-5919`) narrows the verification set for `use`
  collaborators to gatekeepers reachable through non-pending gadgets. Correctness depends on
  `visibleBindings()` staying in sync with what the `use` UI can actually invoke.

The contrast worth naming: `class UseOverseerInterface extends RpcTarget implements Overseer`
(`overseer.ts:8863`) is the same problem solved *structurally* — because it `implements Overseer`,
adding a method to the interface **fails to compile** until someone decides whether `use`
collaborators get it. That is default-deny at the type level, and it is the pattern the three
above should converge on.

### 2.6 Legacy agent spawners silently run as the workspace owner — Medium

`creatorUserId` is captured server-side at binding creation (`overseer.ts:7598-7602`) and replayed
at spawn (`:9634-9642`); spawn takes no identity parameter. But the migration path at
`overseer.ts:1508-1536` reconstructs legacy spawner props and **omits `creatorUserId` entirely**,
so `resolveUserId = creatorUserId ?? this.impl.ownerId` (`:6779-6783`) falls through to the owner.

**Effect.** Every pre-collaborator-support spawner runs on the **workspace owner's** model
credentials and billing, no matter which collaborator triggers it. Silent — nothing surfaces it.
`AgentSelfLoopback` persists that identity durably (`:6837-6842`), so it does not age out.

### 2.7 Resource exhaustion (noisy neighbor) — Medium

Tenancy is not only confidentiality. One verified case:

`packages/workshop-backend/src/user.ts:874-881` bounds a serial R2 delete loop on
`kvRecord.metadata.version`, and deletes the KV record **after** the loop:

```ts
for (let v = 1; v <= kvRecord.metadata.version; v++) {
  await this.env.BLUEPRINT_CONTENT.delete(`${id}/${v}`);
}
...
await this.env.BLUEPRINTS.delete(id);
```

`metadata` comes from an imported archive and is `JSON.parse`d with no schema validation
(`blueprint-archive.ts:290`); `importBlueprint` only deletes `metadata.screenshot`
(`server.ts:391`). So `version: 1e9` is accepted. The blueprint then becomes **permanently
undeletable**, and each delete attempt wedges the owner's user DO. Self-inflicted — you can only
wedge your own DO — but it is durable state corruption, not a slow request.

Related, lower: collaborators can trigger quick-model inference billed to the workspace owner via
`#getNamingQuickModel()` (`overseer.ts:4565`), which resolves the owner's context and therefore the
owner's AnyRouter key (`user.ts:594`). Bounded one-shot completions, arguably intended
("owner pays for their workspace"), but unmetered and unrated.

### 2.8 Connect-link phishing — Medium, design-acknowledged

`packages/mcp-shared/src/connect-nonce.ts:3-6` states the model: *"whoever holds the nonce is
treated as the person who started the flow."* An attacker calls `connectAccount("github")` on
their own account, sends the resulting URL to a victim, and on approval the victim's GitHub
identity attaches to the **attacker's** workshop account (`github.ts:1122`, `user.ts:1565`).
Nothing ties the browser that opens the link to the one that requested it. Mitigated by nonce
secrecy, a 10-minute TTL, single use, and the provider's own consent screen.

### 2.9 Demoted to notes

* **Tokens are plaintext at rest** (`user.ts:554`, `github.ts:1108`). No path found; DO storage
  isolation is the control, and provider tokens are kept out of the user DO. Defense-in-depth wish.
* **The gadget worker omits `disallow_importable_env`** (`overseer.ts:2391-2395`) while code mode
  and the restore forger set it. Re-exposes only its own already-narrow env — a self-recursion/DoS
  surface, **not a tenancy issue**. The asymmetry looks unintentional; **unverified**.
* **`ensureObserver` is called only from `open()`** (`overseer.ts:6500`). This is **by design, not a
  gap**: `docs/observers.md` states the model as "Bob's access is also re-checked every time he
  opens the gadget," with forward exclusion handled per-observation by `authorizeObservation`
  (`overseer.ts:6265+`) via `ObservationDescription.excludeObservers`. Open-time verification plus
  per-observation exclusion is the intended pair.
* **Three literal blueprint ids** (`format.document`, `format.spreadsheet`, `format.slides`) are
  guessable and readable unauthenticated. Deployment-shipped content, intentional.
* **`hashShareKey` throws on non-hex input** (`sharing.ts:63`), uncaught at `overseer.ts:6473-6478`,
  so a malformed `#share=` fragment surfaces as an opaque error instead of a no-op. UX only; a
  test-coverage gap (`sharing.test.ts:184` covers unknown-but-valid-hex, not malformed).

---

## 3. Target model

### 3.1 What a tenant is

**Tenant = the user, materialized as the `UserDurableObject`.** It owns identity, credentials,
connected accounts, the blueprint library, and billing. This is already true; the value of writing
it down is that it becomes the rule new code is measured against.

**Workspace = the unit of sharing, not the unit of tenancy.** It has exactly one `ownerId` and a
recomputed permission graph. Content crosses along its edges; identity and credentials do not.

**No org tier.** Nothing in the codebase supports a group above the user — there is no group
membership anywhere, `ADMINS` is a flat env list, and `sharingDomain` is explicitly not a security
boundary. Adding one would be a new parallel mechanism, which AGENTS.md argues against. **Out of
scope**; if orgs are ever wanted, the honest design is an org DO owning workspaces, and that is a
separate document.

### 3.2 The naming rule

> **Every stored name that a tenant can influence carries a tenant component the tenant cannot
> choose, placed first.**

Concretely: `<tenantDoId>:<rest>`, where `<tenantDoId>` is the user DO id string — server-derived,
already the canonical form in `BlueprintKvRecord.ownerId` (`server.ts:406`) and in the ownership
check (`user.ts:869`). Three consequences, in preference order:

1. **Prefix.** Where a name has no tenant component at all (`EmailAddress`), add one. Overlap
   becomes impossible rather than checked.
2. **Re-derive.** Where a key is correct but taken from the caller (`getAvatar`), take it from the
   session instead and serve cross-tenant reads through a capability that already encodes the
   relationship.
3. **Unguessable + explicit.** Where the design is deliberately bearer-based (blueprints, share
   links, connect URLs), keep it — 128-bit CSPRNG with no `list()` primitive is a real boundary —
   but document it as bearer, and give it revocation.

### 3.3 Structural vs. checked

**Structural patterns already in the tree — extend these, do not add new ones:**

| Pattern | Where | Why it works |
|---|---|---|
| DO-per-user keyed by verified identity | `server.ts:676-712` | wrong name reaches a DO that rejects you |
| Server-minted `props` on entrypoint stubs | `overseer.ts:2115-2121`, `user.ts:1016-1041` | the client never names the identity; it is baked in at mint time |
| `newUniqueId()` capability URLs + single-use nonce | `github.ts:1022-1032` | 256-bit id, no enumeration primitive |
| **Interface-implementing restricted facet** | `overseer.ts:8863` | **a new method fails to compile until someone decides** |
| Capabilities in place of tokens | `user.ts:19-30` | there is no global id to confuse |

The fourth is the one to spread. It is the only place in the tree where forgetting an
authorization decision is a *build failure*.

**Checked at runtime — convert these:**

| Gap | Structural replacement |
|---|---|
| 2.1 `getAvatar(userId)` | **Recommended: keep the login-name key, gate the read behind a capability** minted from an existing relationship (collaborator, chat participant). See the note below on why re-keying is the more expensive option. |
| 2.2 `EmailAddress.getByName(localPart)` | `getByName(`${tenantDoId}:${localPart}`)`. Prefix removes the shared namespace and the squatting primitive together. |
| 2.5 `open()`-only authorization | An `accessGeneration` counter on the Overseer, stamped into the session at `open()` and compared per message, failing closed. **Additive to `ctx.abort()`, not a replacement** — see below. |
| 2.6 legacy spawner identity | Make `creatorUserId` required in `AgentSpawnerBindingProps` and backfill at migration (`overseer.ts:1535`) to the owner **explicitly**, so the fallback is recorded rather than silent. A required field makes the omission a compile error. |
| 2.7 unvalidated `metadata.version` | Validate the archive metadata against a schema in `parseBlueprintArchive`, and move `BLUEPRINTS.delete` before the loop so a failure cannot make a record undeletable. |

**Why the generation check does not replace the abort.** `scheduleRevocationRestart()`
(`overseer.ts:3280`) syncs storage and calls `ctx.abort()`, which kills the DO *and* the loaded
gadget isolates. A per-message check only gates the human's next message. It does not stop an agent
turn already running with resolved capabilities, and it does not stop a gadget isolate holding a
`GatekeeperLoopback` stub — that stub dispatches on the server-supplied `target`
(`overseer.ts:2671-2690`) and never re-checks the human's role, so it keeps working until the
isolate dies. **The structural fix is to make one call do both:** bumping the generation also
schedules the restart, so it is impossible to do half of it. The check closes the "a future call
site forgets to sever" hole for message paths; the abort remains the teardown for live compute.

**Why `AVATARS` should not be re-keyed.** `AiChatAuthorInfo.id` *is* the email
(`user.ts:308-312`, `workshop-shared/src/api.ts:2135-2136`). Keying `AVATARS` by user DO id
therefore forces either changing `AiChatAuthorInfo.id` — a `workshop-shared` change reaching every
chat-history consumer, at the kernel review bar — or adding a parallel `avatarKey` field, which is
a narrower version of the same change. Gating the existing read behind a capability needs no key
migration, no dual-read window, and closes the enumeration oracle, which §2.1 identifies as the part
that actually needs a decision. It also keeps the work inside `workshop-backend`.

### 3.4 Admin and ambient resources

Two rules, both already the practice, worth stating so they are not eroded:

* **Admin config is not admin data access.** `AdminApi` today changes deployment settings and
  nothing else — no user enumeration, no token read. Keep it that way: an admin who needs user data
  should need a separate, audited capability, not an ambient one. That `AUTH_GATEKEEPERS` and
  `DISABLE_PASSWORD_AUTH` stay env-driven rather than in `AdminConfig` is the same principle, and
  is why a compromised admin session cannot change how people sign in.
* **Ambience is granted, never asserted.** AGENTS.md is explicit: a gatekeeper must never assert
  its own ambience. `user.ts:getGatekeeperClassFor()` is the single chokepoint where disabled
  gatekeepers are enforced before a capability is minted, and gadget code cannot reach it. Any new
  cross-tenant resource must route through that chokepoint rather than around it.

### 3.5 Strict-isolation mode (the literal ask)

For deployments that want "never overlap" as stated: an `AdminConfig` flag that behaves as though
`prohibitAllSharing` were set on every workspace, plus disabling share-link creation, blueprint
publishing to the deployment-wide KV, and public context collections. It reuses the existing
enforcement points (`overseer.ts:6462`, `sharing.ts`, `library-gatekeeper.ts`) rather than adding
new ones. Offered as an option; the default recommendation stays "named, revocable crossings."

---

## 4. Migration

Existing deployments hold live DO, KV, and R2 state. What each change costs:

| Change | What moves | Breaks |
|---|---|---|
| `getAvatar` capability gate (recommended) | **no key migration** — the KV key stays the login name | `getAvatar` gains a capability parameter or moves onto a profile stub; frontend `useAvatar.ts:77` follows. Kernel-only change |
| *(rejected alternative)* re-key `AVATARS` by DO id | copy every entry to a DO-id key, dual-read, then delete | forces `AiChatAuthorInfo.id` to change or a parallel `avatarKey` field — a `workshop-shared` change reaching every chat-history consumer |
| `EmailAddress` tenant prefix | **cannot be migrated automatically.** A DO's name is fixed at creation; addresses already claimed live at the unprefixed name | existing claims must be re-created under the new name, or the old namespace read-through for a deprecation window. **Irreversible: existing claims cannot be un-claimed** (`email.ts:445`), so if two tenants' data ends up under one legacy name, only manual resolution works |
| Per-message generation check | add a storage singleton per Overseer, default 0; sessions opened before the change carry no stamp | live sessions at deploy time must be treated as stale (they are already aborted by a deploy) — no data migration |
| `creatorUserId` required | backfill legacy spawner records to the owner at migration | none; makes explicit what already happens |
| `metadata.version` validation | none for stored records; already-corrupted blueprints (if any exist) stay undeletable until the delete order is fixed too | strict validation may reject archives exported by older builds — **verify against `format-blueprints/` fixtures before shipping** |
| Sign-in binding (2.3) | none | changes the `startGatekeeperLogin` / `LoginAttempt` API shape in `workshop-shared` |
| Strict-isolation mode | none; a config flag | turning it on cuts existing collaborators off — one-way in practice, since the sharing edges are still stored but unreachable |

**Irreversible, flagged:**

1. **Email address claims are permanent by design** (`email.ts:445`). Any renaming of that
   namespace strands them.
2. **Blueprint bearer ids have no revocation.** Once published, anyone holding the id reads it
   forever, and a `build` collaborator may publish on the owner's behalf — intentionally
   (`overseer.ts:9292-9295`). `deleteBlueprint` exists (`overseer.ts:8670`); **unverified** whether
   it purges the KV and R2 objects the id addresses. Verify that first — it decides whether
   revocation is a new feature or a bug fix.
3. **Analytics rows already written** carry `user_id` and `gadget_owner_user_id` together
   (`analytics.ts:33-83`). Nothing reads them in-app, but they exist in the operator's pipeline and
   cannot be un-sent.

---

## 5. Sequence

Kernel (`workshop-backend` / `workshop-shared`) is separated from UI, per AGENTS.md. Steps within a
phase are independent. Each names its verification. No step depends on a later one.

### Phase 0 — decisions (no code)

* **D1.** Are avatars public? The answer decides whether 2.1 is a fix or a documented policy.
* **D2.** Is `ExternalMessageGateway` intended to ship? If yes, `callerEmail` needs a verified
  source before any deployment binds it.
* **D3.** Does the deployment want strict-isolation mode, or named-crossings?
* **D4.** Confirm `deleteBlueprint` purges KV and R2 (**unverified**), which decides whether
  blueprint revocation is new work.

### Phase 1 — kernel, no API change (smallest, ship first)

1. **Validate blueprint archive metadata** in `parseBlueprintArchive`, and move
   `BLUEPRINTS.delete` before the R2 delete loop (`user.ts:874-881`).
   *Verify:* unit test that an archive with `version: 1e9` is rejected at import, and that a
   record with a large stored `version` is still deletable. Existing `format-blueprints` fixtures
   must still import.
2. **Require `creatorUserId`** in `AgentSpawnerBindingProps`; backfill the legacy path
   (`overseer.ts:1535`) to the owner explicitly.
   *Verify:* type check fails before the backfill is added; a test asserting a legacy-migrated
   spawner resolves to the owner *and* records that it did.
### Phase 1b — gatekeeper (independent of Phase 1; not kernel, not UI)

3. **Tenant-prefix `EmailAddress`** DO names in `gatekeeper-email`. New claims write **only** to the
   prefixed name; the unprefixed namespace becomes **read-only** for a deprecation window, behind a
   flag. No new claim may land at a legacy name.
   *Verify:* test that two tenants can claim the same local-part; test that an existing
   unprefixed claim still resolves for its original owner; test that a new claim never creates an
   unprefixed record.

### Phase 2 — kernel, structural authorization

4. **Per-message access generation.** Storage singleton on the Overseer, stamped into the session
   at `open()`, compared per message, bumped by every sever-access and binding-attach path. Make
   the bump **also** schedule the revocation restart, so one call does both — the abort stays as
   the teardown for running turns and live gadget isolates (§3.3).
   *Verify:* test that revoking a collaborator mid-session causes the next message to fail closed;
   test that the bump aborts the DO, so an in-flight agent turn does not continue.
5. **Gate `getAvatar` behind a capability** minted from an existing relationship; keep the KV key
   as-is. Kernel-only, no migration.
   *Verify:* test that an authenticated user cannot resolve an arbitrary email's avatar and cannot
   distinguish "no avatar" from "no account"; test that a co-collaborator still resolves.
   Gated on **D1**.

### Phase 3 — kernel + shared API (needs UI follow-up)

6. **Bind the login attempt to its initiator** (2.3): carry a browser-held secret through the
   OAuth `state` and require it on `LoginAttempt.wait()`, so `deliver()` resolves only the waiter
   that proves it started the flow. Same treatment for the connect flow (2.8) closes both.
   *Verify:* test that a `wait()` without the matching secret does not receive the token.

### Phase 4 — UI

7. Frontend `useAvatar` / profile rendering updated for the new `getAvatar` shape (follows 5).
8. Sign-in popup carries and returns the initiator secret (follows 6).
9. Surface which tenant a spawned agent bills, in the Connections panel (follows 2).

### Phase 5 — optional

10. **Strict-isolation mode** as an `AdminConfig` flag reusing `prohibitAllSharing`'s enforcement
    points. Gated on **D3**.
11. **Blueprint revocation**, if D4 shows it is missing.

---

## 6. Not verified

* Whether Workers' `ctx.exports.X({props})` props are unforgeable from outside the worker. The
  entire binding model rests on this platform guarantee; it was not verified from workerd source.
* workerd's post-DNS SSRF filtering, which `web-fetch.ts:12-18` delegates to by design.
* Whether Cloudflare's `launch()` ever reuses a pooled browser process (call sites read; binding
  implementation not).
* Whether `deleteBlueprint` (`overseer.ts:8670`) purges the KV and R2 objects a bearer id
  addresses.
* Whether any out-of-repo service binds `ExternalMessageGateway`, and if so whether it
  authenticates `callerEmail`.
* Per-gatekeeper handling of the `isAdmin` flag forwarded into gatekeeper UIs
  (`server.ts:578-579`) — a gatekeeper could widen admin scope on its own.
* Whether `getAuthenticatedEmail()` returns a validated email shape for gatekeepers other than
  github; `loginOrCreateViaGatekeeper` (`user.ts:390-400`) trusts it.
* Whether every writer of `GadgetRecord.bindings` applies `validateBindingName` before
  `getEnvForLoader` consumes the names.
* Whether redaction covers `github.ts`'s token-exchange error paths the way `mcp-shared`'s
  `redactSecrets` does.
