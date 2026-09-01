---
title: "NestJS Express → Fastify Migration"
description: "The execution plan (now complete) for migrating the API from the default Express adapter to Fastify — why, the per-file audit, the middleware/SSE traps, and the validation results."
author: "Acme Inc."
lastUpdated: 1786924800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
tags: ["fastify", "migration", "performance", "api"]
---

# NestJS Express → Fastify Migration Plan

**Status:** ✅ **Complete** — executed 2026-08-16, all phases landed.

**What shipped:**

- `main.ts` boots on `FastifyAdapter({ bodyLimit: 1 MiB })` with `rawBody: true`;
  `@fastify/cookie`, `@fastify/cors`, and `@fastify/static` (Swagger) registered;
  the three favicon handlers became native Fastify routes.
- All 19 Express type imports migrated (`Request` → `FastifyRequest`,
  `Response` → `FastifyReply`, middleware typed with `IncomingMessage`/
  `ServerResponse`). `types/express.d.ts` → `types/fastify.d.ts`.
- Cookie layer runs on `reply.setCookie`/`clearCookie` (`CookieSerializeOptions`);
  auth interceptors use `FastifyReply`.
- Telescope body capture preserved: instead of the §6.2 preHandler bridge, the
  body is captured **in the interceptor** (runs after Fastify parses the body),
  sidestepping middie's `onRequest` limitation entirely.
- e2e tests converted from supertest to `app.inject()`; the pre-existing broken
  401-envelope assertion was corrected to the real error shape.
- Deps: removed `@nestjs/platform-express`, `@types/express`, `cookie-parser`,
  `@types/cookie-parser`, `supertest`, `@types/supertest`, and the three dead
  deps (`nestjs-pino`, `pino-http`, `helmet`). Added `@nestjs/platform-fastify`,
  `@fastify/cors`, `@fastify/cookie`, `@fastify/static`, `fastify`.
- Validated: typecheck, lint, 156 unit tests, 3 e2e tests, dev boot, prod Rspack
  bundle, runtime smoke (login → cookies → webhook rawBody → SSE `id:`/`data:`
  frames), and request-body capture with PII redaction.

**Post-migration round (Fastify-native upgrades):**

- **API versioning is now explicit paths, not Nest machinery.** `API_VERSION_PREFIX`
  (`/api/v1`) + `apiPath()` in `packages/shared/src/contracts/versioning.ts` is the
  single source of truth; server `@Controller` decorators and the client transport
  both derive from it. `enableVersioning`/`VERSION_NEUTRAL`/`setGlobalPrefix`
  removed. Swagger moved to `/v1/docs` (`/docs` 302-redirects).
- **Versioning hardening round (2026-08-16):** unversioned `GET /version` manifest
  (`ApiVersionManifestSchema`), client 404→manifest negotiation (deploy-any-or-die),
  `Accept-version` header rewrite in `main.ts` (legacy clients), `x-api-version`
  + `Sunset` response headers, per-leaf `version` on `defineContract` with
  version-namespaced react-query keys, the `no-unversioned-controller` ESLint rule,
  and an e2e drift test that injects every contract leaf expecting non-404.
  Invariants + the v2 checklist live in `docs/architecture.md` §5.
- Plugins: `@fastify/request-context` (AsyncLocalStorage correlation store),
  `@fastify/rate-limit` (global 300/min + 60/min on the webhook route),
  `@fastify/compress` (gzip/brotli), `@fastify/etag`, `@fastify/under-pressure`
  (event-loop/heap 503s, health-check wired to `HealthService`).
- Adapter: `exposeHeadRoutes`, `trustProxy` (`TRUST_PROXY=1`), `keepAliveTimeout`
  65s, pino logger with `redact` (`LOG_LEVEL`), `genReqId` reusing
  `x-request-id`/`x-correlation-id` (exposed as `x-request-id` on every response
  via `onSend`), per-route `requestTimeout: 0` for SSE streams, webhook bodyLimit.
- Observability: `onResponse` access log (method · path · status · duration · reqId)
  and `onError` 5xx log through the global `LogService`.
- Validation: `ZodValidationPipe` now compiles schemas with Ajv ONCE (via zod v4's
  native `toJSONSchema`) instead of parsing with Zod per request — Zod remains the
  single source of truth shared with the FE; error shape unchanged.
- New env vars: `TRUST_PROXY`, `LOG_LEVEL` (registered in `turbo.json`).

> **Notes for readers:** the plan below documents *why* each change was needed and
> the traps we hit — keep it as the reference for the two runtime-sensitive spots
> (§6 middleware, §7 webhook/SSE) rather than a step-by-step re-run.

---

This document is the execution plan for migrating `apps/api` from the default
Express HTTP adapter to the Fastify adapter (`@nestjs/platform-fastify`).
It is grounded in a full audit of the current Express-specific surface — every
file below was checked against the actual source.

---

## 1. Why (and why now)

Fastify gives us a 2–4× throughput advantage on JSON-heavy, high-concurrency
workloads with **near-zero architectural downside** because NestJS already
abstracts the HTTP layer. This project is exactly the Fastify profile:

- A public, signature-verified **webhook endpoint** that must stay cheap under
  hammering (rate-limited per IP).
- **Two SSE streams** (telescope live feed + email-log events) with many idle
  concurrent connections.
- **JWT auth on every route** — guards/interceptors run per request.
- An admin panel + web app that will grow (marketplace-style traffic).

The `@nestjs/platform-express` package can be removed afterwards; everything
below works on Fastify 5 (Nest 11 officially supports Fastify v5).

**Non-goals for v1:** HTTP/2, static asset serving, server-side rendering,
moving off Nest. This is an *adapter swap*, not a rewrite.

---

## 2. Audit: every Express touch-point in `apps/api`

| # | File | Express dependency | Fastify change |
|---|------|--------------------|----------------|
| 1 | `src/main.ts` | `NestFactory.create(AppModule, { rawBody: true })` | `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { rawBody: true })` |
| 2 | `src/main.ts` | `app.use(cookieParser())` | `instance.register(@fastify/cookie)` |
| 3 | `src/main.ts` | `app.use("/favicon.ico", …)` + 2 Swagger favicon redirects (`res.setHeader`/`res.send`/`res.redirect`) | Fastify routes via `app.get(...)` + `reply` |
| 4 | `src/main.ts` | `app.enableCors(...)` | Same call — but **requires `@fastify/cors` installed** (adapter lazy-loads it) |
| 5 | `src/modules/auth/services/cookies.service.ts` | `import type { Response } from "express"`; `response.cookie(...)` / `response.clearCookie(...)` | `FastifyReply`; `reply.setCookie(...)` / `reply.clearCookie(...)`; `CookieOptions` → `CookieSerializeOptions` |
| 6 | `src/modules/auth/interceptors/set-auth-cookies.interceptor.ts` | `Request`/`Response` types, `request.query` | `FastifyRequest`/`FastifyReply` (logic unchanged) |
| 7 | `src/modules/auth/interceptors/clear-auth-cookies.interceptor.ts` | same | same |
| 8 | `src/modules/notifications/email/email-webhook.controller.ts` | `RawBodyRequest<Request>` + `req.rawBody` | `RawBodyRequest<FastifyRequest>` — `rawBody: true` is supported by the Fastify adapter, verified in the adapter source |
| 9 | `src/common/middleware/correlation-id.middleware.ts` | `Request, Response, NextFunction`; `res.setHeader` | **Works unchanged via bundled middie** — only the types change (`IncomingMessage`/`ServerResponse`) |
| — | _(telescope module removed)_ | — | — |
| 11 | `src/common/interceptors/response.interceptor.ts` | `request.headers.accept`, `request.responseData` | `FastifyRequest` — logic unchanged |
| 12 | `src/modules/auth/auth.controller.ts` | `@Req() req: Request`; `req.cookies` in refresh flow | `FastifyRequest` — `req.cookies` works via `@fastify/cookie` |
| 13 | `src/modules/auth/guards/*` (auth, refresh-token, super-admin) | `Request` types, `req.headers`, `req.ip` | `FastifyRequest` — all present |
| — | _(telescope module removed)_ | — | — |
| 15 | `src/modules/sessions/sessions.controller.ts`, `impersonation.controller.ts` | `Request` types | `FastifyRequest` |
| 16 | `src/common/utils/client-info.ts` | `req.headers["user-agent"]`, `req.ip` | `FastifyRequest` — works |
| 17 | `src/modules/notifications/email/webhook-throttler.ts` | `getTracker` reads `req.headers` + `req.ip` | `FastifyRequest` — works (`@nestjs/throttler` v6 supports Fastify) |
| 18 | `src/modules/notifications/email/email-log.controller.ts` | `@Sse("events")` | Verify SSE on Fastify (§7) |
| — | _(telescope module removed)_ | — | — |
| 20 | `test/app.e2e-spec.ts` | `supertest(app.getHttpServer())` | `app.inject()` (light-my-request, Fastify-native) |
| — | `package.json` | `@nestjs/platform-express`, `cookie-parser`, `supertest`, `@types/express`, `@types/cookie-parser`, `@types/supertest` | swap/remove |
| — | `package.json` | `nestjs-pino`, `pino-http`, `helmet` — **declared but never imported** (verified: only `package.json` matches) | remove, or swap `helmet` → `@fastify/helmet` if we want security headers |

**Not affected (verified):** Prisma adapter (`@prisma/adapter-pg`), `@nestjs/swagger`,
`@nestjs/schedule`, `nestjs-zod` pipes, the `{ success, data, meta }` envelope,
the Next.js proxies in `apps/web` + `apps/admin` (they proxy HTTP — platform-agnostic).

---

## 3. Phase 1 — Dependencies + adapter swap (30 min)

### 3.1 Install

```bash
pnpm --filter @workspace/api add @nestjs/platform-fastify@^11.1.28 @fastify/cors @fastify/cookie
pnpm --filter @workspace/api remove cookie-parser @types/cookie-parser
```

Keep `@nestjs/platform-express` + `@types/express` **installed until Phase 8**
so a broken migration is a one-line revert. `supertest` stays until Phase 7.

### 3.2 `src/main.ts` — adapter swap

```ts
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter({ bodyLimit: 1024 * 1024 }),
		{ rawBody: true }, // stays — Fastify adapter supports it for the webhook
	);

	app.enableShutdownHooks();
	app.enableCors({ /* options unchanged — @fastify/cors is auto-registered */ });

	// @fastify/cookie replaces cookie-parser; gives request.cookies + reply.setCookie
	const instance = app.getHttpAdapter().getInstance();
	await instance.register(fastifyCookie);
	...
}
```

**Acceptance:** `pnpm --filter @workspace/api dev` boots, `/health` returns 200,
`/auth/login` still sets `adminAccessToken`/`refreshToken` cookies.

> ⚠ **Do this swap first and boot.** The remaining phases are type/behaviour
> fixes — the adapter swap is the only one that can't be half-done.

---

## 4. Phase 2 — Type migration (mechanical, ~1 hr)

Swap every `import type { Request } from "express"` to Fastify types. The
**logic does not change** — `headers`, `ip`, `cookies`, `query`, `params` all
exist on `FastifyRequest`; only the shape/typing differs.

```ts
// before
import type { Request, Response } from "express";

// after
import type { FastifyRequest, FastifyReply } from "fastify";
```

Per-file map (all 19 files from §2): `Request` → `FastifyRequest`,
`Response` → `FastifyReply`, `NextFunction` → `void` (middie middleware keeps
the `(req, res, next)` signature but types become
`IncomingMessage`/`ServerResponse` — see §6).

### 4.1 Known typing differences

| Express | Fastify |
|---------|---------|
| `req.query` — qs-parsed (nested objects, `a[]=`) | `req.query` — flat `fast-querystring`; **repeated keys become arrays** |
| `req.headers["X-Client-Type"]` — case-insensitive lookup | header keys are **lowercased** — always read lowercase (`"x-client-type"`) |
| `req.ip` string | `req.ip` string (from `trustProxy`/socket) |
| `res.cookie(...)` | `reply.setCookie(...)` |
| `CookieOptions` | `CookieSerializeOptions` (from `@fastify/cookie`) |
| `res.setHeader(...)` | `reply.header(...)` |

### 4.2 Gotcha: query-string parsing

Express uses `qs` (supports `?ids[]=1&ids[]=2` and nested objects); Fastify uses
`fast-querystring` (flat keys, repeated keys → array). Audit the codebase for
bracket-notation query params:

```bash
grep -rn "\[\]" apps/api/src --include="*.ts" | grep -v spec | head
```

The current consumers (`?limit=`, `?page=`, `?client_type=`, filters)
all use flat keys — expected to pass as-is. **Verify with a smoke test.**

---

## 5. Phase 3 — Cookie layer (30 min)

### 5.1 `cookies.service.ts`

`setCookie`/`clearCookie` become `reply.setCookie`/`reply.clearCookie`:

```ts
import type { FastifyReply } from "fastify";
import type { CookieSerializeOptions } from "@fastify/cookie";

export class CookieService {
	public static setCookie(
		response: FastifyReply,
		name: CookieNames,
		value: string | null | undefined,
		options?: Partial<ExtendedCookieOptions>, // CookieSerializeOptions & { sameSite... }
	): CookieResult {
		...
		if (value === null || value === undefined) {
			response.clearCookie(name, mergedOptions);
		} else {
			response.setCookie(name, value, mergedOptions);
		}
		...
	}
}
```

`cookie.config.ts` swaps `CookieOptions` → `CookieSerializeOptions`. Same field
names (`httpOnly`, `secure`, `sameSite`, `path`, `maxAge`), so the existing
`ExtendedCookieOptions` merge logic survives unchanged.

### 5.2 Interceptors

`set-auth-cookies.interceptor.ts` / `clear-auth-cookies.interceptor.ts`:
only the generic types change.

```ts
const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
const response: FastifyReply = context.switchToHttp().getResponse<FastifyReply>();
```

**Acceptance:** login → logout round-trip works on both web (3000) and admin
(3001); cookie isolation (`adminAccessToken` vs `accessToken`) preserved;
token refresh rotates cookies.

---

## 6. Phase 4 — Middleware (the subtle part)

### 6.1 How Nest 11 + Fastify handles middleware

Verified in the `@nestjs/platform-fastify` adapter source: Nest bundles
**middie** and registers it automatically, so `MiddlewareConsumer` / Nest
middleware **keeps working**. Middleware receives the **raw Node
`IncomingMessage`/`ServerResponse`** (middie patches `originalUrl` onto it),
so:

- `CorrelationIdMiddleware` — **zero logic change**. `req.headers`,
  `res.setHeader("X-Correlation-Id", …)`, `next()` all work on raw objects.
  Only the type annotations change.

```ts
import type { IncomingMessage, ServerResponse } from "node:http";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
	public use(req: IncomingMessage & { correlationId?: string }, res: ServerResponse, next: () => void): void { ... }
}
```

### 6.2 ⚠ `TelescopeCaptureMiddleware` — `req.body` goes missing

middie middleware runs at Fastify's **`onRequest`** phase — **before body
parsing**. On Express, `req.body` was populated before Nest middleware ran; on
Fastify it will be `undefined`, so request-body capture silently
becomes `null`.

**Fix — a tiny body-bridge `preHandler` hook** (registered once in `main.ts`
or a module) that mirrors the parsed body onto the raw request so
the middleware keeps reading `req.body` exactly as today:

```ts
// main.ts — after register(fastifyCookie)
instance.addHook("preHandler", (request, _reply, done) => {
	if (request.body !== undefined) (request.raw as Request & { body?: unknown }).body = request.body;
	if (request.rawBody !== undefined) (request.raw as Request & { rawBody?: unknown }).rawBody = request.rawBody;
	done();
});
```

The ALS scope wrapping (`RequestSpanContext.storage.run(store, next)`) is
untouched — the downstream Nest handler chain still executes inside the scope,
so spans/Prisma capture keep working.

**Acceptance:** after migration, open a request detail page — request
**bodies still appear** for POST/PUT calls, and `requestBody` is not `null`.

### 6.3 Favicon routes

Replace the three `app.use(path, handler)` handlers with Fastify routes:

```ts
app.get("/favicon.ico", (_req, reply) => {
	reply.header("Content-Type", "image/svg+xml").send(faviconSvg);
});
app.get("/docs/favicon-32x32.png", (_req, reply) => reply.redirect("/favicon.ico"));
app.get("/docs/favicon-16x16.png", (_req, reply) => reply.redirect("/favicon.ico"));
```

(The middleware path would technically work through middie, but native routes
are the correct Fastify idiom and avoid middie for something this simple.)

---

## 7. Phase 5 — Webhook + SSE + rate limiting (verify, don't rebuild)

### 7.1 Resend webhook (`email-webhook.controller.ts`)

`rawBody: true` is supported by the Fastify adapter (confirmed in the adapter's
`registerJsonContentParser(rawBody)` → `req.rawBody = body`). Change:

```ts
public async receive(@Req() req: RawBodyRequest<FastifyRequest>, ...): Promise<...> {
	const rawBody: string = typeof req.rawBody === "string" ? req.rawBody
		: Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8")
		: JSON.stringify(req.body ?? {});
	...
}
```

**Acceptance:** send a real email via the demo flow → the delivery webhook flips
`status` to `delivered` in the DB. Run the existing signed-webhook test script
and confirm byte-exact signature verification still passes.

### 7.2 SSE streams (`email-log.controller.ts`)

Nest 11's Fastify adapter supports `@Sse()` (the router writes frames to the
reply). Two things to **verify at runtime** (they only misbehave under load):

1. Reconnect semantics — the client sends `Last-Event-ID`; confirm
   the `id:` frame line is emitted and the client resumes from the right `seq`.
2. Keep-alive `ping` frames still flush on idle connections (the 25s interval).

**Acceptance:** open the email-log page in the admin → live feed updates on new
requests without page refresh; pause/resume the network tab → reconnects
without CORS errors (already same-origin through the Next.js proxy).

### 7.3 `@nestjs/throttler` + the per-IP webhook limiter

`@nestjs/throttler` v6 supports Fastify. `webhook-throttler.ts` reads
`req.headers` (lowercased keys — already lowercase here) and `req.ip` — both
exist on `FastifyRequest`. Type the `getTracker` input as `FastifyRequest` and
re-run the rate-limit unit tests.

---

## 8. Phase 6 — e2e tests via `app.inject()`

Replace supertest with Fastify's native `app.inject()` (light-my-request) — no
HTTP server needed:

```ts
// test/app.e2e-spec.ts
app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true });
await app.init();

const res = await app.inject({ method: "GET", url: "/health" });
expect(res.statusCode).toBe(200);
expect(res.json()).toMatchObject({ success: true });

// POST with cookies / headers:
const login = await app.inject({
	method: "POST",
	url: "/auth/login",
	headers: { "content-type": "application/json", "x-client-type": "admin" },
	payload: { email: "admin@example.com", password: "Admin@123" },
});
```

Then remove `supertest` + `@types/supertest` from devDependencies.

**Acceptance:** `pnpm --filter @workspace/api test:e2e` passes (3 specs).

---

## 9. Phase 7 — Build pipeline (Rspack + built-in SWC)

The current pipeline is `rspack.config.mjs` — Rspack bundles `src/main.ts`
directly, using `builtin:swc-loader` for legacy decorators +
`emitDecoratorMetadata`. Verification checklist:

1. **Rspack bundle** (`pnpm build`) — `webpack-node-externals` keeps bare packages
   external; Fastify plugins (`@fastify/cors`, `@fastify/cookie`) resolve from
   `node_modules` at runtime. Boot `node dist/main.js` and hit `/health`,
   `/auth/login` (401 without cookies), and one SSE endpoint.
2. **Watch mode** (`pnpm dev` → `rspack --watch` + `RunScriptWebpackPlugin`
   auto-restart) — hot reload on a changed controller.

> If the bundle breaks on the Fastify dynamic imports (`enableCors` does
> `import('@fastify/cors')`), add `@fastify/cors`/`@fastify/cookie` to the
> bundle's `external` list explicitly.

---

## 10. Phase 8 — Cleanup, benchmark, rollback

### 10.1 Remove Express

Only after Phases 1–7 pass on both dev and prod boot paths:

```bash
pnpm --filter @workspace/api remove @nestjs/platform-express @types/express
```

Also remove the three dead deps (`nestjs-pino`, `pino-http`, `helmet`) — they
are declared but never imported anywhere in `apps/api/src` (verified). If we
want security headers, add `@fastify/helmet` and register it in `main.ts`
instead.

### 10.2 Benchmark (keep honest)

Before/after numbers with the same machine + script:

```bash
# baseline: npx autocannon -c 50 -d 10 http://localhost:8080/health
```

Track: req/s, p99 latency, and (for SSE) max concurrent idle connections.
Target expectation: **1.5–3× throughput on JSON routes**; the SSE streams
should hold more idle connections.

### 10.3 Rollback

Because `@nestjs/platform-express` is kept installed until the end, rollback is
a **one-line diff** in `main.ts` (drop the `FastifyAdapter`, revert
`cookie-parser`) plus the e2e test file. Document the exact revert commit hash
in the PR description.

### 10.4 Docs

Update `docs/architecture.md` (adapter, middleware note, cookie layer) and
`docs/performance-and-dx.md` (add Fastify + benchmark results).

---

## 11. Risk register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `req.body` missing in middleware | **Fixed** | — |
| SSE reconnect/keep-alive quirk on Fastify | Medium | §7.2 explicit runtime test |
| Query-string parse difference (`qs` vs `fast-querystring`) | Low | §4.2 grep + smoke test |
| `@fastify/cookie` registration timing (must be `await`ed before routes) | Low | register in `bootstrap()` before `listen()` |
| Rspack bundle breaks on Fastify lazy `import('@fastify/cors')` | Low | §9 external list |
| Cookie `sameSite`/`secure` semantics drift | Low | §5 login/logout round-trip on both apps |
| `enableCors` throws without `@fastify/cors` | Certain (if forgotten) | §3.1 install step |

---

## 12. Suggested PR sequence

1. **PR A** — Phases 1–2: adapter swap + type migration + cookies (bootable,
   all unit tests green, manual smoke on both apps).
2. **PR B** — Phases 3–5: middleware bridge, favicon routes, webhook + SSE +
   throttler verification.
3. **PR C** — Phases 6–8: e2e via `app.inject()`, build-pipeline check,
   cleanup + benchmark + docs.

Each PR is independently shippable; rollback is one line until PR C lands.
