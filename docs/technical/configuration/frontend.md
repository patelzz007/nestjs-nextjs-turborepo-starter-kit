---
title: "Configuration & Environment Variables (Next.js apps)"
tags: ["configuration", "environment", "nextjs", "zod", "security"]
description: "How web, admin and merchant read environment variables: one zod-validated config per app, split into a browser-safe env.client and a server-only env.server, validated once and failing fast with value-free errors. Also the Expo app's EXPO_PUBLIC_* and MOBILE_* variables."
order: 7
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# Configuration & Environment Variables (Next.js apps)

> [!NOTE] This page covers the three Next.js apps (`apps/web`, `apps/admin`,
> `apps/merchant`) and `packages/client`. The API and the analytics consumer
> use the same building blocks and error format — see
> [API Configuration](./api.md). The Expo app (`apps/mobile`) has its own
> section: [§10](#10-the-mobile-app-appsmobile).

## Table of Contents

1. [The rule in one sentence](#1-the-rule-in-one-sentence)
2. [Architecture](#2-architecture)
3. [Why there are two modules per app](#3-why-there-are-two-modules-per-app)
4. [Variables per app](#4-variables-per-app)
5. [How validation fails](#5-how-validation-fails)
6. [Using config in code](#6-using-config-in-code)
7. [Adding a variable](#7-adding-a-variable)
8. [Tests](#8-tests)
9. [FAQ](#9-faq)
10. [The mobile app (`apps/mobile`)](#10-the-mobile-app-appsmobile)

---

## 1. The rule in one sentence

**Only the env modules read `process.env`**. They parse it once through a zod
schema, and everything else imports the typed result. The env modules are
`lib/env/env.client.ts`, `lib/env/env.server.ts` and `lib/env/env.runtime.ts`
(which only checks Next's own `NEXT_RUNTIME`; see [§5](#5-how-validation-fails)). ESLint enforces this
(`no-restricted-properties`, see [ESLint → 3.2](../tooling/eslint.md#32-env-boundary-processenv)).

---

## 2. Architecture

```
packages/shared/src/runtime/app-env.ts      ← building blocks (no process.env here)
  NodeEnvSchema, HttpUrlEnvSchema, BooleanFlagEnvSchema,
  OptionalIntervalMsEnvSchema, CookieDomainEnvSchema,
  NextAppServerEnvSchema, createPublicEnvSchema, parseEnvOrThrow, EnvValidationError
packages/shared/src/runtime/fail-fast-env.ts ← loadEnvOrExit (start-up gate, no process access here)

apps/<app>/lib/env/
├── env.schema.ts   ← the app's contract: <App>ClientEnvSchema + <App>ServerEnvSchema (pure, testable)
├── env.client.ts   ← exports `clientEnv`  — NEXT_PUBLIC_* only, safe to import anywhere
├── env.server.ts   ← exports `serverEnv`  — `import "server-only"`, never in a browser bundle
├── env.runtime.ts  ← exports `resolveProcessExit()` — `process.exit` on Node.js, `undefined` on Edge
└── env.test.ts

apps/<app>/instrumentation.ts               ← `register()` loads both modules through `loadEnvOrExit`
apps/<app>/instrumentation.test.ts          ← exit code / value-free message / Edge wiring

packages/client/src/lib/api/config.ts       ← the client package's own env module
  (NEXT_PUBLIC_API_URL → API_BASE_URL, NODE_ENV → RUNTIME_NODE_ENV)
```

The replaced pieces: the all-optional `EnvSchema` in `schemas/api/env.ts` was
never used by the apps (it has since been deleted, together with the API's old
`validateApiEnv`), the old `webEnvSchema`/`adminEnvSchema` validators only
ran inside two root layouts (merchant had none), and about 27 raw
`process.env` reads with hardcoded `localhost` fallbacks were spread across
proxies, login pages, the impersonation banner, the session badge and the
client package. The web/admin validators have been removed. Every read now goes
through the modules above.

---

## 3. Why there are two modules per app

| | `env.client.ts` | `env.server.ts` |
| --- | --- | --- |
| Keys | `NEXT_PUBLIC_*` only (compile-time **and** runtime check) | Anything server-only (`NODE_ENV`, `COOKIE_DOMAIN`, future secrets) |
| When is the value fixed? | **Build time.** Next inlines each literal `process.env.NEXT_PUBLIC_X` into the bundle | **Runtime.** Read by the Node server process when it starts |
| Where can it be imported? | Anywhere: Server Components, Client Components, proxy | Server code only. `import "server-only"` fails the build otherwise |
| Visible to users? | **Yes, treat every value as public** | No |

Two Next.js facts drive the split (see `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`):

1. **Inlining is textual.** Next replaces `process.env.NEXT_PUBLIC_API_URL` with
   the value **only when that exact member access is written in the source**.
   `process.env[name]`, `const env = process.env; env.X`, or destructuring are
   *not* inlined and read `undefined` in the browser. That is why
   `env.client.ts` lists every variable literally:

   ```ts title="apps/web/lib/env/env.client.ts"
   export const clientEnv: Readonly<WebClientEnv> = parseEnvOrThrow(
   	WebClientEnvSchema,
   	{
   		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
   		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
   	} satisfies Record<keyof z.input<typeof WebClientEnvSchema>, string | undefined>,
   	WEB_ENV_SCOPE.client,
   );
   ```

   The `satisfies` clause makes the compiler reject a schema key that has no
   literal read, and a literal read with no schema key.

2. **Non-public variables are server-only.** In a browser bundle they are
   empty. `server-only` turns an accidental import from a Client Component into
   a build error ("Preventing environment poisoning" in the Next docs), and the
   lint rule `workspace-boundaries/no-server-import-in-client-component` reports
   it in the editor.

`createPublicEnvSchema` accepts only `NEXT_PUBLIC_*` keys. Declaring
`DATABASE_URL` in a client schema fails to compile with
`"DATABASE_URL is not a NEXT_PUBLIC_* variable and cannot be public config"`
and also throws at runtime.

---

## 4. Variables per app

Every app's `.env.example` lists these with comments. Copy it to `.env`.

| Variable | web | admin | merchant | Module | Rule |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | required | required | required | client (+ `packages/client` config) | absolute http(s) URL, trailing `/` stripped |
| `NEXT_PUBLIC_APP_URL` | required | | | client | web's own origin (SSR/proxy refresh `Origin`) |
| `NEXT_PUBLIC_ADMIN_URL` | | required | | client | admin's own origin |
| `NEXT_PUBLIC_MERCHANT_URL` | | required | required | client | merchant origin (own origin / banner link) |
| `NEXT_PUBLIC_WEB_URL` | | required | | client | consumer site links |
| `NEXT_PUBLIC_SESSION_POLL_MS` | | optional | | client | whole ms. Unset or `0` → `null` (disabled) |
| `NODE_ENV` | set by Next | set by Next | set by Next | server | `development` / `test` / `production` |
| `COOKIE_DOMAIN` | optional | optional | optional | server | bare host (`localhost`, `.example.com`) |

Empty values (`FOO=`) are treated as unset. There are **no hardcoded URL
fallbacks**. A missing origin fails fast instead of silently pointing
production at `localhost`. The app origins must also appear in the API's
`CORS_ORIGINS`.

`NEXT_PUBLIC_API_URL` is validated twice on purpose: by the app (so the app's
startup error names it) and by `packages/client/src/lib/api/config.ts` (a
library cannot trust its caller). Both read the same inlined value.

---

## 5. How validation fails

`parseEnvOrThrow(schema, source, scope)` throws an `EnvValidationError` that:

- lists **every** invalid variable, not just the first one,
- says *why* (`is required but not set`, `must be an absolute http:// or https:// URL`, …),
- **never prints a value**. Messages are built from variable names and schema
  messages only, and any value that still appears in a custom message is
  replaced with `[redacted]`.

```text
Invalid environment configuration for apps/web (public NEXT_PUBLIC_* config):
  - NEXT_PUBLIC_APP_URL: is required but not set
Set these variables (see the app's .env.example). Values are never printed.
```

When it fires:

| Stage | What catches it |
| --- | --- |
| `next build` | Route modules that import `env.client` are evaluated while collecting page data, so a missing `NEXT_PUBLIC_*` **fails the build** (verified: `/auth/login`). |
| `next start` / `next dev` | `instrumentation.ts` → `register()` loads `env.server` and `env.client` through `loadEnvOrExit` before the server handles traffic. An invalid runtime value (e.g. `COOKIE_DOMAIN=https://x`) prints the message above and **exits the process with code 1** (Node.js runtime; verified on all three apps for both commands). |
| Browser | `env.client` re-parses the inlined values when first imported. It can't disagree with the build-time check, but it fails loudly if it ever did. |

### Why `register()` has to exit by itself

Next.js does not stop when `register()` rejects. `next start` logs
`Failed to prepare server`, keeps the port open and answers every request with
a 500, so an orchestrator sees a "running" process and never rolls back. The
API fails fast instead, and the Next apps now match it:

```ts title="apps/web/instrumentation.ts"
export async function register(): Promise<void> {
	const { resolveProcessExit } = await import("./lib/env/env.runtime");
	await loadEnvOrExit({ loadEnv: loadEnvModules, exit: resolveProcessExit(), reportError: reportEnvError });
}
```

`loadEnvOrExit` (`packages/shared/src/runtime/fail-fast-env.ts`) runs the
loader. On an `EnvValidationError` it writes `error.message`, which names
variables and never values, then calls `exit(INVALID_ENV_EXIT_CODE)` (`1`).
Any other error is rethrown unchanged. The helper never touches `process`.
The app injects `exit`, so the helper stays unit-testable and safe in the
browser-importable shared package.

**Edge runtime.** `register()` also runs in the Edge runtime, and the Edge
sandbox's `process.exit` throws. `env.runtime.ts` returns `process.exit` only
when `process.env.NEXT_RUNTIME === "nodejs"` and `undefined` otherwise. With
no `exit`, `loadEnvOrExit` rethrows, which is the previous behaviour. The
comparison is deliberately a string literal: Next inlines `NEXT_RUNTIME` into
each server bundle, so the Edge bundle folds the branch to `false` and drops
the `process.exit` reference. Because of this, the build no longer warns
"A Node.js API is used (process.exit)". `NEXT_RUNTIME` is set by Next, not by
operators. It is not validated as configuration, but it is declared in
`turbo.json` (`turbo/no-undeclared-env-vars`).

> [!NOTE] Env modules are the one sanctioned exception to "importing a module
> must not read the environment" (rules/00). Parsing at module load is what
> makes the build and startup fail fast. Keep them tiny and side-effect-free
> otherwise.

---

## 6. Using config in code

```ts
// Anywhere (server or client): public config
import { clientEnv } from "@/lib/env/env.client";
const apiBaseUrl: string = clientEnv.NEXT_PUBLIC_API_URL;

// Server only (proxy, server components, route handlers): runtime config
import { serverEnv } from "@/lib/env/env.server";
import { NodeEnvSchema } from "@workspace/shared";
const secure: boolean = serverEnv.NODE_ENV === NodeEnvSchema.enum.production;
```

**Demo accounts are not configuration.** Each login page (a server component) offers the seeded
one-click demo logins only when `NODE_ENV` is `development`, and never anywhere else — there is
deliberately no flag, so a production deploy cannot expose them by configuration. The policy is
`resolveDemoAccounts()` in `packages/client/src/lib/auth/forms/demo-accounts-policy.ts`; each app's
list lives in a `server-only` module (`apps/*/lib/auth/demo-account-list.ts`) and is never even
loaded outside development, so the credentials never reach a production bundle.

- Compare `NODE_ENV` through `NodeEnvSchema.enum.*`, never string literals.
- SSR API callers take the app origin explicitly:
  `resolveConfig({ ...DEFAULT_WEB_SERVER_API_CONFIG, clientOrigin: clientEnv.NEXT_PUBLIC_APP_URL, ...config })`.
  `ServerApiConfigInput` makes `clientOrigin` required, so the library no
  longer has an env-derived default.
- `clearAuthCookies` requires `secure`. Proxies pass it from `serverEnv.NODE_ENV`.
- Shared UI in `packages/ui` still uses the bundler-replaced
  `process.env.NODE_ENV` idiom for dev-only warnings. That package has no env
  module and reads no configuration.

---

## 7. Adding a variable

1. **Decide public vs server-only.** If the browser needs it, it is public and
   must be named `NEXT_PUBLIC_*`. Never put a secret in a `NEXT_PUBLIC_*` var.
2. Add it to the app's schema in `lib/env/env.schema.ts`, reusing a building
   block from `@workspace/shared` (`HttpUrlEnvSchema`, `BooleanFlagEnvSchema`,
   …). Add a new building block to `packages/shared/src/runtime/app-env.ts`
   only when two or more apps need it.
3. Add the literal read to `env.client.ts` / `env.server.ts`. The `satisfies`
   clause fails to compile until the two lists match.
4. Document it in the app's `.env.example` (required/optional, default, format).
5. Add the fixture value to the app's `vitest.config.ts` `test.env` if required.
6. Add/extend `lib/env/env.test.ts` (missing → named error, default, format).
7. If it is not `NEXT_PUBLIC_*` and affects the build output, declare it in
   `turbo.json` `env` (`turbo/no-undeclared-env-vars`).

---

## 8. Tests

| Test | Covers |
| --- | --- |
| `packages/shared/src/runtime/app-env.test.ts` | Every building block, missing → names listed, empty = unset, defaults, URL/flag/interval/cookie-domain validation, values never printed (incl. redaction), strict unknown keys, public-key guard |
| `packages/shared/src/runtime/fail-fast-env.test.ts` | `loadEnvOrExit`: exits with code 1 and prints the value-free message (reported before exiting), does nothing on a valid env, never exits without an `exit` (Edge), rethrows non-env errors |
| `apps/*/instrumentation.test.ts` | Real `register()` wiring with a stubbed env: Node.js + invalid `COOKIE_DOMAIN` → `process.exit(1)` and a message without the value. Valid env → no exit. Edge / unset runtime → rethrow, never `process.exit` |
| `apps/*/lib/env/env.test.ts` | App schema: only `NEXT_PUBLIC_*` keys, defaults, missing origins named. `clientEnv` exposes only `NEXT_PUBLIC_*` keys. `serverEnv` has none |
| `packages/client/src/lib/api/config.test.ts` | Package env module: parsed values, trailing slash, missing/invalid → fail fast without echoing the value |
| `apps/web/eslint-boundaries.test.ts`, `packages/client/src/eslint-boundaries.test.ts` | The `process.env` ban and import boundaries actually fire |

Vitest does not load `.env`. Each app's `vitest.config.ts` sets deterministic
fixture values in `test.env`, and aliases `server-only` to Next's own empty
module, which is what Next does under the `react-server` condition.

---

## 9. FAQ

**Can I change a `NEXT_PUBLIC_*` value without rebuilding?** No. It is baked
into the bundle at build time. Values that must change per environment without
a rebuild belong on the server (`env.server.ts`) and reach the client as props.

**Why does `next build` fail on my machine after pulling?** A required variable
is missing from your `.env`. The error names it. Copy the new line from
`.env.example`.

**Why not `@t3-oss/env-nextjs`?** The same pattern takes a few dozen lines on
top of the zod schemas already shared with the API. It needs no extra
dependency and uses one error format everywhere.

---

## 10. The mobile app (`apps/mobile`)

The Expo app follows the same rule — **only one module reads `process.env`** — with two kinds of
variables (docs/technical/mobile/mobile-app.md §9.3, §9.5):

| Variable | Read by | Required | Purpose |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `src/lib/env.ts` (bundled) | outside development | The API's absolute URL — `https://` outside development; `http://` allowed in development to reach an API on another machine |
| `EXPO_PUBLIC_API_PORT` | `src/lib/env.ts` | no (`8080`) | Development only: the API's port on the dev machine, joined with the host Expo Go connected to (never `localhost` — on a phone that is the phone) |
| `EXPO_PUBLIC_IOS_STORE_URL`, `EXPO_PUBLIC_ANDROID_STORE_URL` | `src/lib/env.ts` | no | `https://` store pages the "Update required" screen opens (ADR 033) |
| `MOBILE_APP_NAME` | `app.config.ts` (build machine) | no (`Starter`) | Display name, at most 30 characters |
| `MOBILE_APP_SLUG` | `app.config.ts` | no (`starter`) | Expo slug |
| `MOBILE_BUNDLE_ID` | `app.config.ts` | no (`com.example.starter`) | iOS bundle id and Android package — letters and digits in reverse-DNS segments |
| `MOBILE_SCHEME` | `app.config.ts` | no (`starter`) | Deep-link scheme (Expo Router's default links only) |

- **`EXPO_PUBLIC_*` is public.** Metro inlines each literal `process.env.EXPO_PUBLIC_…` read into
  the bundle, so the value is readable by anyone who has the app. No secret is ever configured this
  way ([`rules/10`](../../../rules/10-security-auth-authorization.md)). Changing one needs a new bundle.
- **Validation.** `resolveMobileEnv()` parses the raw values with zod. An invalid environment builds
  no API client: the root guard shows the **configuration error screen**, naming the variable and an
  example value — never the configured value. `app.config.ts` validates `MOBILE_*` and stops
  `expo start` / `expo export` with the variable's name.
- **The env boundary is lint-enforced** exactly like the web: `no-restricted-properties` on
  `process.env` everywhere in `apps/mobile` except `src/lib/env.ts` (`apps/mobile/eslint.config.mjs`).
  `app.config.ts` runs on the build machine and is not part of the bundle.
- **Where to set them:** `apps/mobile/.env` (copy `.env.example`; Expo loads it on start) or the
  build environment. `turbo.json` lists them in the `build` task's `env`, so a changed value
  re-runs `expo export` instead of replaying a cached bundle.
- **Tests:** `src/lib/env.test.ts` (every rule above) and `src/runtime/app-runtime.test.ts`
  (an invalid environment ends at the configuration error).

