# Plan — 2026-11-19: per-endpoint API versioning with inheritance

Goal: one endpoint can have a v1 and a v2 at the same path and under the same name, and a client on v2 still reaches every endpoint that never changed.

Status: built on 2026-11-19, with the server side and the client pin done and per-version contract schemas deferred. Section 11 records what was built and where it differs from this plan; [ADR 094](../adr/094-per-endpoint-api-versioning.md) is the decision of record. This work ran in the same development phase as the code quality cleanup (`PLAN-2026-11-18-ai-slop-cleanup.md`).

## 1. The problem with today's design

| Where | Today | What goes wrong |
|---|---|---|
| Server | The version sits on the whole controller: `@Controller(apiPath("/claims"))`. | A v2 of one endpoint needs a second controller class, or the whole controller moves. |
| URL | `/api/v2/...` only exists for routes someone registered under v2. | A client on v2 gets a 404 for every endpoint that has no v2. `Accept-version: v2` has the same problem, because it rewrites every URL. |
| Contract | A leaf has one optional `version` field, so it is v1 or v2, never both. | Two versions need two keys (`get` and `getV2`), so the client function name changes too. |
| Client | The version comes from the leaf. | Callers have to know which endpoints are v2 and mix them by hand. |

## 2. The decision

The version belongs to one endpoint, and a newer version inherits what it does not replace.

A client asks for one version of the whole API. Each endpoint answers with its newest handler that is not newer than the version asked for.

```ts
@Controller(apiPath("/claims"))
export class ConsumerClaimsController {
	@Get(":id")              // v1, and every later version until something replaces it
	public get(...): Promise<Claim> { ... }

	@Get(":id")
	@Version("v2")           // replaces it from v2 onward
	public getV2(...): Promise<ClaimV2> { ... }

	@Get()                   // never changed: answers on v1 and v2
	public list(...): Promise<Page<Claim>> { ... }
}
```

| Request | Handler |
|---|---|
| `GET /api/v1/claims/:id` | `get` |
| `GET /api/v2/claims/:id` | `getV2` |
| `GET /api/v2/claims` | `list` (inherited from v1) |

The contract keeps one leaf and one name; the versions live inside it. Leaves that never changed keep today's shape.

```ts
get: defineContract({
	method: "GET",
	path: "/claims/:id",
	versions: {
		v1: { input: GetClaimInput, response: singleResponse(ClaimSchema), sunsetAt: ... },
		v2: { input: GetClaimInput, response: singleResponse(ClaimV2Schema) },
	},
}),
```

Each app pins one version when it creates its client, for example `createApiClient({ version: "v2" })`. `api.claims.get` keeps its name and takes the types of the pinned version. An old mobile build pinned to v1 keeps working; a new build pins v2 and gets every v2 change at once.

## 3. How the same name is handled in each layer

| Layer | Rule |
|---|---|
| URL | Same path, only the `/vN` part differs. |
| Contract and client | Same leaf name. The pinned version picks the schema. |
| Controller | Same class. The new method carries the suffix (`getV2`); the old one is untouched. |
| Schemas | The new shape carries the suffix (`ClaimV2Schema`). |
| Handlers and services | Usually one. Both controller methods call the same use case, and the v1 method maps the result down to the old shape. A second handler only when the behaviour really differs. |
| Removal | Deleting v1 deletes the old method and schema, and the suffix is dropped from the survivor in the same change. |

## 4. Decisions

| # | Decision | State |
|---|---|---|
| V1 | `/api/v2/x` falls back to the v1 handler when `x` has no v2. | Approved by the owner (2026-11-19). |
| V2 | The new version carries the suffix in code names (`getV2`, `ClaimV2Schema`); the suffix is dropped from those names when the old version is deleted. URLs are not affected (see below). | Confirmed by the owner (2026-11-19). |
| V3 | One pinned version per app; a per-call override exists only as an escape hatch. The override is explicit in the request and is logged and counted. | Confirmed by the owner (2026-11-19). |

### What "dropping the suffix" does and does not touch

The suffix in V2 is a name in the code. It is never part of a URL, and no URL changes when it is dropped.

| Thing | Rule |
|---|---|
| URLs | Every business URL always carries its version: `/api/v1/...`, `/api/v2/...`. There is no unversioned alias such as `/api/claims`, so nothing has to be re-pointed when a version is removed. |
| A client that calls `/api/v2/claims/:id` | Keeps working before and after v1 is deleted. The route is the same; only the method behind it is renamed from `getV2` to `get`. |
| A client that still calls the deleted `/api/v1/claims/:id` | Gets `410 Gone` in the standard error envelope, with the code `API_VERSION_REMOVED`. Before removal the endpoint sends `Sunset`, so this is announced. |
| Which handler answers a version | Decided by the ordered version list in section 5, never by editing the URL text. Today's `request.url.replace(API_VERSION_PREFIX, ...)` in `register-fastify-hooks.ts` is replaced by parsing the version segment (step 4). |

### The per-call override

| Part | Rule |
|---|---|
| On the wire | The `Accept-version` header the API already reads. No new header or query parameter. |
| In the client | An explicit option on the call (`{ version: "v2" }`); it sets the header. There is no global switch other than the app's pin. |
| Logging | The access line records the version served and whether it came from the pin (URL) or the override (header). |
| Monitoring | A counter per endpoint and app for overridden calls, shown with the other traffic figures in the operations console, so long-lived use of the escape hatch is visible. |

## 5. Mechanism

Nest has a custom versioning mode (`VersioningType.CUSTOM`) where a function returns the versions a request accepts, in order. For `/api/v2/...` it returns `[v2, v1]`. The installed adapter (`@nestjs/platform-fastify` 12.4.2, `adapters/fastify-adapter.js`) picks the first version in that list that has a handler. That is the inheritance in section 2.

This is the Nest versioning machinery that `bootstrap-app.ts` says was avoided because of `VERSION_NEUTRAL` path bugs. It has not been run in this repository, so step 1 below is a spike. If the spike fails, the fallback is to register the inherited routes explicitly at boot: same behaviour, more code of our own.

## 6. Steps

Each step ends with the scoped checks for the workspaces it touched. The full gate runs once, with the cleanup, at the end of the phase.

| # | Step | What happens | Main files |
|---|---|---|---|
| 1 | Spike (throwaway branch of the work, no merge) | Prove three things with tests: the unversioned routes (root, health, email webhook, version manifest) still resolve; the version can be read from the URL path before routing; Swagger can show one document per version. Decide between custom versioning and explicit boot-time registration. | `apps/api/src/bootstrap/` |
| 2 | ADR | New ADR replacing architecture §6: the decision, the inheritance rule, the naming rule, the removal rule, the spike result. | `docs/adr/094-*.md`, `docs/technical/architecture.md` |
| 3 | Shared contract | `ApiContractDef` gains `versions`; the single `version` field goes. A helper resolves a leaf for a pinned version (newest entry not newer than the pin). `apiPath()` loses its version argument. Version order is defined once (`ApiVersionSchema` order). | `packages/shared/src/contracts/versioning.ts`, `define-contract.ts` |
| 4 | Server routing | Read the version from the URL, hand Nest the ordered list, keep unversioned routes neutral. `@Version` on a method marks a replacement. The version is parsed from the URL segment, not replaced in the URL text. Unknown version → 404 with the standard error envelope; a removed version of an endpoint → 410 `API_VERSION_REMOVED`. `Accept-version` is the per-call override and goes through the same resolution. | `apps/api/src/bootstrap/bootstrap-app.ts`, `register-fastify-hooks.ts` |
| 5 | Headers, manifest and override visibility | `x-api-version` reports the version asked for; `Sunset` is sent per endpoint from the contract's `sunsetAt`. `GET /version` lists which endpoints differ per version. The access line and a counter record calls that used the override. | `register-fastify-hooks.ts`, `version.controller.ts`, operations traffic figures |
| 6 | Client | `createApiClient({ version })` pins the version; the router resolves each leaf's schemas and types from the pin; query keys include the pinned version. Per-call override kept as the escape hatch. | `packages/api-client/src/router.ts`, `http.ts`, `packages/client` |
| 7 | Guard rails | Lint: no hand-written version in a controller path; a `@Version` method must share method + path with an older handler in the same controller. Test: every contract `versions` entry has a matching server handler and the reverse (extends the existing OpenAPI contract spec). | `apps/api/lint-rules/`, `packages/oxlint-config`, `apps/api/e2e/` |
| 8 | OpenAPI and docs site | One document per version (`/v1/docs`, `/v2/docs`), each showing the resolved set of endpoints. API reference generation follows. | `apps/api` openapi export, `apps/docs` |
| 9 | Worked example | Add a real v2 to one low-risk endpoint (proposal: `sample-category`, the golden reference) end to end: schema, contract, controller method, client, tests, seed unaffected. It is the pattern future work copies. | `contexts/catalog`, `packages/shared/src/contexts/catalog` |
| 10 | Docs and rules | Update `rules/02`, `rules/05`, `rules/24`, `docs/technical/api/http-server.md`, `docs/technical/api/routes.md`, and the progress note. | `rules/`, `docs/technical/` |

## 7. What stays and what changes

| Stays | Changes |
|---|---|
| `/api/v1/...` URLs, so no existing client breaks | `apiPath()` loses its version argument |
| `x-api-version` and `Sunset` headers | `Sunset` becomes per endpoint, not only per version |
| The unversioned allowlist and the lint rule | The lint rule also forbids a hand-written version in a path |
| `GET /version` manifest | It can list which endpoints differ per version |
| Authorization, tenancy, audit, rate limiting, idempotency | Each versioned handler declares its own permission, like any handler; the coverage specs (`public-operation-coverage`, `platform-operation-coverage`) must see both versions |

No database change, migration or seed change is expected.

## 8. Tests the work must add

| Behaviour | Test |
|---|---|
| v1 request reaches the v1 handler, v2 request reaches the v2 handler | e2e on the worked example |
| v2 request to an endpoint with no v2 reaches the v1 handler | e2e |
| Unknown version | e2e: 404, standard envelope |
| Removed version of an endpoint | e2e: 410 `API_VERSION_REMOVED`; the newer version's URL is unchanged |
| Override is recorded | e2e: a call with `Accept-version` is marked as overridden in the access line and counted; a pinned call is not |
| Unversioned routes unaffected | e2e: root, health, email webhook, version manifest |
| `Accept-version` header | e2e: same result as the URL form |
| A v2 handler without its own permission mapping fails the build | coverage spec |
| Contract and server agree per version | OpenAPI contract spec |
| Client pinned to v1 and to v2 gets the right schema and query key | `packages/api-client` unit tests |
| Rate limit key still separates versions | existing rate-limit e2e, extended |

## 9. Order within the phase

| Order | Work | Reason |
|---|---|---|
| 1 | Cleanup batches 0 to 3 (baseline, forwarding files, dead code, line noise) | Small and low risk; they shrink what the later work touches. |
| 2 | This plan, steps 1 to 10 | It changes the contract helper and the client router, which the later cleanup batches read. |
| 3 | Cleanup batches 4 to 9, including the conversion of pass-through query handlers | They then work on the final shape of controllers and contracts. |
| 4 | Cleanup batch 10: consistency sweep, docs, the full gate once, the report | Covers both pieces of work. |

## 10. Risks

| Risk | Handling |
|---|---|
| The Nest versioning machinery repeats the earlier `VERSION_NEUTRAL` path bugs | Step 1 proves it with tests before anything else is built; explicit boot-time registration is the fallback. |
| A v2 handler ships without authorization or audit | The existing coverage specs are extended to count every version of a route. |
| Inheritance hides a breaking change (v2 client silently gets v1 behaviour that was meant to change) | The contract/server agreement test: a `versions.v2` entry with no server handler fails, and the reverse. |
| Old mobile builds | They stay pinned to v1; nothing about v1 URLs or shapes changes. |
| Both mobile repositories | Client changes under `apps/mobile` are listed so the owner can mirror them in `expo-boilerplate`. |

## 11. As built (2026-11-19)

### Mechanism: what the spike chose

`VersioningType.CUSTOM` was not used. The installed Fastify adapter matches a version constraint per route, and a custom extractor cannot express "the newest handler not newer than the asked-for version" without a router of our own. The build uses the plan's fallback idea, done at decoration time instead of at boot:

| Part | As built |
|---|---|
| Versioning mode | `enableApiVersioning(app)`: Nest URI versioning with the prefix `api/`, so every version is a literal path. No URL is rewritten. |
| Inheritance | `@ApiController(path)` (`platform/presentation/http/versioning/api-controller.decorator.ts`) runs after the method decorators, groups the handlers by HTTP method and path, and gives each one `Version([...])` with every version from its `@SinceApiVersion` (default: the first) up to the start of the next handler of the same route. |
| Conflict | Two handlers of one route starting at the same version throw `ConflictingApiVersionsError` at startup. |
| Proof | `api-controller.decorator.spec.ts`: 7 tests on a real Fastify app (v1, v2 replacement, v2 inheritance, unknown version, no version, plain controller, conflict). |

### Step by step

| # | Step | Outcome |
|---|---|---|
| 1 | Spike | Done, see above. Unversioned routes, version-from-path and one Swagger document per version all proven by tests. |
| 2 | ADR | Done: ADR 094; architecture §6 rewritten. |
| 3 | Shared contract | **Partly.** `API_VERSIONS`, `API_URI_VERSION_PREFIX` and `API_VERSION_OVERRIDE_HEADER` added. The leaf's unused `version`, `deprecatedSince` and `sunsetAt` were removed. A per-leaf `versions` map is **deferred** (ADR 094, "Not built yet"): typing the client router by the pinned version changes every procedure type, and it lands with the first endpoint that really needs a v2 shape. `apiPath()` keeps its version argument and stays as the URL builder for clients and scripts. |
| 4 | Server routing | Done. 94 controller files (102 controllers) moved to `@ApiController`. Unknown version → 404 in the standard envelope. The `onRequest` `Accept-version` rewrite was removed: Fastify had already matched the route, so it never rerouted anything. 410 `API_VERSION_REMOVED` is **deferred** until a version is actually removed. |
| 5 | Headers, manifest, override | `x-api-version` reports the served version, and `Sunset` is sent per deprecated version. `GET /version` lists every served version. The access line marks an override `(override)`. **Deferred:** per-endpoint `Sunset` (needs step 3's map), and the override counter on the operations console. |
| 6 | Client | Done for the pin: `ApiClientConfig.apiVersion`, `ApiRequestContext.apiVersion`, `ProcedureCallOptions.apiVersion` (sends `Accept-version`), and the token refresh and downloads follow the pin. Pinned types per version are deferred with step 3. |
| 7 | Guard rails | Lint rule `api/no-unversioned-controller` rewritten: `@Controller` only bare or on the unversioned paths (7 canary tests). The coverage specs walk handler methods, so a `@SinceApiVersion` handler is checked like any other. The contract-per-version agreement test is deferred with step 3. |
| 8 | OpenAPI | Done: `buildOpenApiDocument(app, version)`, Swagger at every version's docs path, the docs gate covering all of them, and `operationId` pinned to `Controller_method`. The exported artifact and the docs site stay on the default version. |
| 9 | Worked example | **Deferred** with step 3, so the example covers the contract as well as the controller. |
| 10 | Docs and rules | Done: `http-server.md`, `routes.md`, `api/README.md`, `dos-and-donts.md`, `adding-a-feature.md`, `tooling/oxlint.md`, `errors.md`. |

### Found along the way

| Finding | Action |
|---|---|
| `onRoute` still set a `rateLimit` config on the email webhook, but `@fastify/rate-limit` was removed earlier (ADR 071), so nothing read it. | Removed. The webhook's real limit is the `webhook` throttler policy (`WEBHOOK_RATE_LIMIT_PER_MINUTE`). |
| `http-server.md` and `errors.md` still described `@fastify/rate-limit` as keyed by IP + API version. | Corrected: limits are the throttler policies, keyed by the caller, never the URL, so v1 and v2 share one budget. |
| Swagger's default `operationIdFactory` appends `_v1` to versioned routes, which would have broken the public-route marking. | `operationId` pinned to `Controller_method`. |
