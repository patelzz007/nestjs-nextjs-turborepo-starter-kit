# `@workspace/api-client`

The one API client of every frontend — the three Next.js apps and the Expo mobile app. It owns the
typed router built from the `@workspace/shared` contracts, `fetch` with zod validation of every
input and response, the mapping of the standard error envelope to typed errors, and the two session
transports: **cookies** for the browser client types (`web`, `admin`, `merchant`) and **body
tokens** for `mobile` (Bearer access token, refresh token in the request body,
[ADR 029](../../docs/adr/029-mobile-client-body-token-transport.md)). It runs in browsers, in the
Next.js server and in React Native, so it uses nothing but `fetch`, `URL`, `FormData` and
`AbortSignal`.

## Entry points

| Import | Contents | May depend on |
| --- | --- | --- |
| `@workspace/api-client` | `createApiClientContext`, `apiRouter` + `defineQuery` / `defineMutation`, `createCaller`, `fetchQuery` / `fetchMutation`, `fetchBodyTokenLifecycleMutation` (mobile sign out / sign out everywhere), `ApiError` / `UpgradeRequiredError` / `ApiResponseContractError`, the refresh cooldown and the transport types | `@workspace/shared`, `zod` |
| `@workspace/api-client/react` | `buildClientRouter`, `createQueryProcedure`, `createMutationProcedure`, `createProcedureForDef` — TanStack Query hooks over the router | the core, `react`, `@tanstack/react-query` (optional peers) |
| `@workspace/api-client/testing` | fetch stubs (`jsonResponse`, `headersOf`, `firstFetchCall`, …) and `MemoryTokenProvider` — **test suites only** | the core, `vitest` types |

Runtimes: browser ✅, Next.js server ✅, React Native ✅, Node backends ❌ (lint forbids
`apps/api` and the workers from importing it; share contracts through `@workspace/shared`).

## Structure

```
src/
  index.ts                 core entry
  config.ts                injected config: zod schema, createApiClientContext, InvalidApiClientConfigError
  transport.ts             cookie / token request transports; the token session end
  token-provider.ts        TokenProvider (where the token transport keeps its tokens)
  request.ts               procedure callers, fetch + validation, the 401 pipeline (withSessionRefresh)
  refresh.ts               transient-failure cooldown, single flight, body-token refresh
  router.ts                apiRouter, defineQuery / defineMutation, query keys, resolveRequest, router walker
  errors.ts                ApiError, UpgradeRequiredError (426), SessionRefreshUnavailableError, readErrorPayload
  http.ts                  URL and header building (X-Client-Type, X-App-Version, Authorization — the
                           client type, app version and header names are the shared ones)
  response-contract.ts     the one place a response body is validated (ADR 022)
  body-token-contract.ts   the stored token pair + refresh envelope, derived from the shared API contract
                           (RefreshTokenBodySchema / RefreshMobileResponseSchema / BodyTokenFieldsSchema)
  transient-failure-breaker.ts  the cooldown model shared with the web route proxy
  react/                   "./react" entry
  testing/                 "./testing" entry
```

## Getting started

Build the context **once** per app (it holds the single-flight refresh) and pass it to the callers
or hooks.

```ts
// Mobile (token transport) — the app resolves the address and backs the provider with expo-secure-store.
const context = createApiClientContext({
	baseUrl: apiBaseUrl,
	clientType: "mobile",
	transport: { kind: "token", tokenProvider: secureStoreTokenProvider },
	appVersion: nativeApplicationVersion, // semantic version, sent as X-App-Version (ADR 033)
	headers: deviceHeaders, // static headers for every request, refresh included (percent-encoded device model / name)
	onSessionExpired: () => router.replace("/sign-in"),
});
// Sign out (the refresh token in the body, outside the 401 pipeline — ADR 029):
await fetchBodyTokenLifecycleMutation(context, apiRouter.auth.logout);
const api = buildClientRouter(apiRouter, context); // from "@workspace/api-client/react"
const { data } = api.auth.me.useQuery(undefined);
```

```ts
// Web (cookie transport) — what @workspace/client's useApi does for you.
const context = createApiClientContext({
	baseUrl: API_BASE_URL,
	clientType: "merchant",
	transport: { kind: "cookie", refreshSession: refreshOnce },
	onSessionExpired: handleUnauthorized,
});
```

A wrong config (mobile on the cookie transport, a browser type with an app version, a missing app
version, a malformed URL, a provider without its four methods) throws `InvalidApiClientConfigError`
when the context is built. A 426 surfaces as `UpgradeRequiredError`; the full token-transport flow
(single-flight refresh, retry once, session end) is in
[`docs/technical/security/token-refresh.md`](../../docs/technical/security/token-refresh.md#13-token-transport-the-mobile-app).

Commands: `pnpm --filter @workspace/api-client test | lint | typecheck | build`.

The web apps keep importing the moved code from `@workspace/client/lib/api/api-request` and
`@workspace/client/lib/api/endpoints`, which re-export this package.

## Key conventions

- Never read the environment here; inject it ([`docs/technical/mobile/mobile-app.md` §6.3](../../docs/technical/mobile/mobile-app.md#63-configuration-is-injected-never-read-from-the-environment)).
- Keep the core framework-free and runtime-neutral; lint enforces it
  ([`docs/technical/tooling/eslint.md` §3.1](../../docs/technical/tooling/eslint.md#31-import-boundaries)).
- Contracts come from `@workspace/shared`; never re-declare a request or response shape
  ([`rules/05`](../../rules/05-contracts-zod-api.md), [ADR 022](../../docs/adr/022-response-contracts.md)).
- Query keys come from the router defs (`def.queryKey(input)` / `def.scopeKey(scope)`), never a
  hand-typed array ([`rules/06`](../../rules/06-tanstack-state-forms-tables.md)).
- Package placement and dependency direction: [`rules/01`](../../rules/01-repository-architecture.md).

## Environment variables

None. Every value is injected through `createApiClientContext`.
