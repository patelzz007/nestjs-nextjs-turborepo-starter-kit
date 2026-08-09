---
title: "Logging System"
description: "The 40 must-have items for the in-house Datadog-style logging service (terminal + DB, no external SaaS) — each grounded in the current code."
order: 12
author: "Acme Inc."
lastUpdated: "2026-08-05"
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# Logging System

> [!NOTE] A self-hosted, Datadog-style logging service — **no external SaaS**. Every item states **what**
> it is, **why** it matters, the **current state** (verified against the code today), and **how**
> to implement it — written so a junior developer with ~6 months of experience can execute
> without guessing.
>
> **Ground truth** (checked 2026-08-05):
>
> - `apps/api/src/modules/logs/logs.service.ts` wraps NestJS's built-in `Logger`
>   (terminal only — it never writes to the DB).
> - `apps/api/prisma/schema.prisma` already has a `Log` model (level, message, context, userId,
>   correlationId, metadata, durationMs, errorGroup, tags, timestamp) but **no code writes to it**.
> - The pino packages (`nestjs-pino`, `pino-http`, `pino-pretty`) are **already in
>   `apps/api/package.json`** but **not wired up**.
> - `CorrelationIdMiddleware` (sets `req.correlationId` + `X-Correlation-Id` header) and
>   `ResponseInterceptor` (captures `request.responseData`, wraps every response in
>   `{ success, data, meta: { correlationId, timestamp } }`) already exist.
>
> This system must follow the repo's non-negotiable rules: no `any`/`unknown`/`never`, no type
> casting, infer types from zod schemas, generic types first, explicit access modifiers + return
> types on every method, and structured zod-schema-driven payloads.
>
> **Related docs:** the email system has its own guide — [Email Template System](./email.md).

---

# 🪵 Logging Service (Datadog-style, self-hosted)

> [!NOTE] **The goal:** a logging system that gives you the three things Datadog gives you — one place
> to see everything, rich structured fields to filter/aggregate on, and the ability to trace a
> single request through the whole stack — **without any external SaaS**. Logs go to **two
> places at once**: the **terminal** (dev experience) and the **`Log` table in Postgres**
> (searchable history, dashboard material). `LogService` is the single entry point; everything
> else builds on it.

## 1. `LogService` writes to the DB (the #1 gap)

**What:** today `LogService.info/warn/error` only call NestJS's `Logger` (terminal). The `Log`
model in Prisma is a complete, unused table. Wire `PrismaService` into `LogService` and persist
every entry.
**Why:** terminal logs vanish on restart — there's no history, no dashboard, no audit trail.
**How:** inject `PrismaService` into `LogService`; add a `private persist(entry)` that maps
level/message/context/userId/metadata/durationMs/errorGroup/tags/correlationId onto the `Log`
model and `create`s it. Fire-and-forget with `void` + internal catch (a logging failure must
never break the request). Do **not** await it inline — enqueue or `void` it.

## 2. Async persistence (never block the request)

**What:** DB writes are slow (~1–5ms each); a hot endpoint doing 3 log calls would add latency.
**Why:** logging must be invisible to request latency.
**How:** wrap persistence in a tiny in-process queue (array + flush) or simply `void
this.prisma.log.create(...).catch(...)`. Better: a `LogQueueService` with a `setInterval`
flush (e.g. every 1s or when 50 entries queue up). All `LogService` methods stay synchronous
`void` — callers never await logging.

## 3. Level system with a runtime threshold

**What:** a `LogLevel` zod enum (`trace | debug | info | warn | error | fatal`) and a
`LOG_LEVEL` env var (default `info`).
**Why:** you need to filter noise (debug in dev, warn+ in prod) without code changes.
**How:** `LOG_LEVEL` env → `TypedConfigService` getter → `LogService` drops entries below the
threshold **before** formatting/persisting. Zod schema in `packages/shared` (`LogLevelSchema`)
so both FE and BE share the literal set.

## 4. Structured metadata with a zod schema (no free-form objects)

**What:** `LogOptions.metadata` is currently `Record<string, string|number|boolean|null|undefined>`.
**Why:** rule 13 (no `typeof`), and structured fields are what make logs queryable.
**How:** define `LogEntrySchema` (zod) — `{ message, level, context?, userId?, correlationId?,
durationMs?, errorGroup?, tags: string[], metadata: Record<string, z.union([...])> }` — and have
`LogService` parse every entry through it before persisting. Invalid entries get logged as
`invalid-log-entry` rather than throwing.

## 5. Every entry gets `correlationId` automatically

**What:** `CorrelationIdMiddleware` already stamps `req.correlationId`. Thread it into
`LogService` so every log line within a request carries the same ID.
**Why:** this is the "trace one request end-to-end" superpower — filter the dashboard by a
correlationId and see the whole journey.
**How:** `LogService` needs the current request. Options: (a) use `AsyncLocalStorage` (set in a
middleware, read anywhere — recommended), or (b) pass `correlationId` explicitly from callers
that have the request. Do (a) — it's the clean way and `nestjs-pino` works the same way.

## 6. Terminal output goes through pino (pretty in dev, JSON in prod)

**What:** wire the already-installed `nestjs-pino` + `pino-http` + `pino-pretty`.
**Why:** JSON lines in prod (grep-able, parseable, pipeable to `jq`) and pretty colored output
in dev (readable).
**How:** `LoggerModule.forRoot({ pinoHttp: { transport: process.env.NODE_ENV === "production"
? undefined : { target: "pino-pretty", options: { singleLine: true } } } })` in `app.module.ts`.
Keep `LogService` as the app-facing API but make it delegate to the pino logger so there's ONE
logger in the process (no double output).

## 7. Request logging middleware (method, path, status, duration)

**What:** a log line for **every** HTTP request: `POST /auth/login 200 42ms`.
**Why:** the "request log" is the backbone of any observability tool — it's where you start
every investigation.
**How:** `pino-http` does this for free once wired (it logs on response finish). Add
`request.responseData` (already captured by `ResponseInterceptor`) + `correlationId` + `userId`
(once auth attaches it) into the log object.

## 8. Log **errors** with the real stack trace

**What:** `LogService.error` currently takes `trace?: string` but most call sites don't pass it.
**Why:** "Failed to send password reset email" without a stack is useless.
**How:** add a `captureStackTrace` / pass `err.stack`; also log the error `name` + `code`.
Centralize with an `ErrorLogSchema` zod type for error metadata.

## 9. Global exception filter → log every unhandled error

**What:** a `catch-all` filter that logs 5xx with full details (and 4xx at warn/info).
**Why:** today, errors that don't go through `LogService` manually are invisible.
**How:** `ExceptionFilter` (`@Catch()`) registered via `APP_FILTER` that builds the structured
entry — status, message, stack, path, correlationId, userId — and calls `LogService.error`.

## 10. Per-context loggers (Nest `Logger.setContext` parity)

**What:** keep the `context` field ("AuthService", "EmailService") as a **first-class filter**.
**Why:** "show me everything EmailService logged" is a daily need.
**How:** `context` is already in `LogOptions` — ensure every call site passes it (audit the
current call sites; several omit it), and make the dashboard filter by context.

## 11. `userId` stamped on authenticated log lines

**What:** when a request is authenticated, attach the user's id to every log entry.
**Why:** "what did user X do / what broke for user X" is the most common support question.
**How:** in the middleware/`AsyncLocalStorage` store, set `userId` from `request.user?.id`
(populated by `AuthGuard`) and have `LogService` merge it into every entry unless overridden.

## 12. Duration tracking helper

**What:** a `time(label)` → `end()` helper (or `LogService.timed(message, fn)`) that logs
`durationMs`.
**Why:** performance regression hunting needs per-operation timing, and `Log` already has a
`durationMs` column that's never used.
**How:** `const t = this.logService.start("query-users"); ... this.logService.end(t)`. Keep it
simple — no decorators, just explicit start/end.

## 13. Error-group / error-tracking column wired

**What:** `Log.errorGroup` exists in the schema but nothing sets it.
**Why:** grouping "the same error N times" is how you find the top bugs.
**How:** hash `(context + message + first-frame)` → store as `errorGroup`; the dashboard counts
by `errorGroup` (that's the Datadog "error aggregation" equivalent).

## 14. Tags (first-class filtering)

**What:** `Log.tags String[]` exists and is unused; populate it with e.g. `["auth"]`,
`["email"]`, `["cron"]`.
**Why:** cross-cutting filters ("all auth-related logs across services") without a context
rename.
**How:** allow `LogOptions.tags?: readonly string[]` and thread through; keep a shared tag
vocabulary in a zod tuple (`LogTagSchema`) so tags can't drift.

## 15. Correlation across the **proxy** (web/admin) → API

**What:** the Next proxies (`[proxy:web]` lines) and the API currently log independently.
**Why:** "the page loaded slow — was it the proxy refresh or the API?" requires joining them.
**How:** the API already returns `X-Correlation-Id`; have the proxies read the browser's
`X-Correlation-Id` (or generate one) and include it in their `[proxy:*]` log lines, and
forward it in the refresh request headers so the API's log carries the same id.

## 16. Client-side logs too (web/admin console + POST endpoint)

**What:** a `POST /logs/client` endpoint (authenticated, throttled) that accepts client-side
errors/warnings.
**Why:** browser errors (hydration mismatches, API failures) are invisible in server logs; the
Datadog equivalent is Browser RUM.
**How:** shared `ClientLogSchema` in `packages/shared`; a tiny `logger` util in the web/admin
apps that batches and sends `{ level, message, url, stack? }`; a `LogController` route that
persists via `LogService` with `context: "client"`. Keep a console mirror too.

## 17. Sanitization — never log secrets

**What:** strip `password`, `authorization`, `set-cookie`, `cookie`, tokens, API keys from
log metadata.
**Why:** one accidental `console.log(loginDto)` is a breach.
**How:** a `sanitizeMetadata` step in `LogService` that removes keys matching a denylist
(zod union of literal keys) before formatting/persisting — and unit test it.

## 18. PII awareness — email hashed or truncated in non-audit logs

**What:** emails/phones appear in some log lines ("New user registered: x@y.com").
**Why:** GDPR/DPA hygiene; operational logs shouldn't be a PII store.
**How:** keep full PII only in the **audit** table (when built); in `Log`, store
`email: "x***@y.com"` (a `maskEmail` helper in shared) or the user id only.

## 19. `Log` retention policy (cron)

**What:** the `Log` table grows forever — add a retention cron (e.g. delete > 30 days; keep
errors longer).
**Why:** unbounded log tables tank query performance and storage.
**How:** reuse `TaskScheduleService` pattern (`@Cron(EVERY_DAY)`), `deleteMany({ where: {
createdAt: { lt: now - RETENTION_DAYS } } })`, log how many rows were purged.

## 20. Log dashboard API (`GET /logs`)

**What:** a SuperAdmin `GET /logs?level=&context=&userId=&errorGroup=&tag=&from=&to=&page=`
endpoint with filters + pagination.
**Why:** the "Datadog search" experience needs an API to power the UI (item 21).
**How:** `LogController` (new file — the `logs` module only has the service today) +
`LogQuerySchema` (zod) for the query params; cursor/offset pagination (see auth-roadmap #23
pattern); zod-validated `LogResponse` shapes in `packages/shared`.

## 21. Log viewer UI in the admin panel

**What:** a `/settings/logs` page: filter bar (level/context/user/tag/time), table, detail
drawer, "show only this correlationId" drill-down.
**Why:** that's the actual Datadog experience — searchable, filterable logs in the browser.
**How:** smart page component fetches `GET /logs`, low-level `LogTable`/`LogFilterBar`
components stay data-agnostic (rules 9–11); server-side filters, client renders.

## 22. Per-level color + readable terminal format

**What:** dev terminal lines with colors (info=white, warn=yellow, error=red, fatal=red bold)
and a fixed layout: `LEVEL  [context] message  {metadata}`.
**Why:** scanning a busy terminal for the error line is the daily dev flow.
**How:** `pino-pretty` handles colors; configure `singleLine: true` and a custom `messageFormat`.

## 23. Log-level file output (optional rotating file)

**What:** `LOG_FILE_PATH` env → write logs to `logs/app.log` (rotating, e.g. 10MB × 5).
**Why:** when stdout is lost (systemd, crash) a file is the fallback.
**How:** pino `transport` target `pino/file` with `destination` + rotation, or `pino-roll`.
Make it optional (unset = stdout only).

## 24. Health-check endpoint includes log-DB write check

**What:** `GET /health` (already exists) also verifies the `Log` table is writable (a test
write or a `count()`).
**Why:** if logging silently breaks, you lose observability — you want a health signal.
**How:** in the existing health check, `await prisma.log.count()` with a small timeout; report
`logging: "ok" | "degraded"`.

## 25. Fatal-level + startup banner

**What:** a `fatal` level for unrecoverable errors, plus a startup log block (port, env, node
version, DB reachable).
**Why:** knowing what version/env is running when a bug report lands is 50% of diagnosis.
**How:** in `main.ts` `bootstrap()`, after `listen`, log the boot summary via `LogService`.

## 26. Child loggers (namespace via context only)

**What:** a `LogService.child(context)` that returns a scoped logger.
**Why:** avoids repeating `{ context: "X" }` at every call site and keeps context consistent.
**How:** return a small object `{ info, warn, error, child }` that pre-fills context. The
DB/terminal write still goes through the single parent.

## 27. Rate/cap on log volume (per-service circuit breaker)

**What:** if a hot loop logs 10k/min, drop or sample entries beyond a cap.
**Why:** a buggy loop can fill the DB and mask the real signal.
**How:** a simple counter window (e.g. max 500 entries/sec process-wide; beyond → drop + log
`log-sampling-active` once per window).

## 28. Sampling for debug/trace at scale

**What:** `debug`/`trace` entries sampled (e.g. keep 1 in 10) in prod, full in dev.
**Why:** debug is too chatty for prod but too valuable to delete.
**How:** `sampled?: boolean` option; when set, persist only if `Math.random() < LOG_SAMPLE_RATE`.

## 29. Zod-typed `LogService` options (rule 13/5)

**What:** `LogOptions` should be an inferred type from a zod schema, not a hand-written
interface with stringly-typed keys.
**Why:** repo rules — infer from zod, use tuples over `as const`, no `typeof` guards.
**How:** `LogEntrySchema` in shared (item 4) — `LogOptions = z.input<typeof LogEntrySchema>`
at the `LogService` boundary.

## 30. Test coverage for `LogService`

**What:** unit tests: level filtering, sanitization, metadata parsing, DB write (mocked
Prisma), queue flush.
**Why:** logging is infrastructure — a regression is invisible and expensive.
**How:** `apps/api` currently has no test setup for the API (no vitest/jest config found in
`package.json`) — add one (`vitest` like admin, or `jest`), or extract `LogService`'s pure
parts (format, sanitize, level-check) into testable functions in `packages/shared` and test
those there first (cheap win, no test infra needed).

## 31. `GET /logs/:id` single-entry view

**What:** fetch one log entry by id (for the detail drawer in item 21).
**Why:** the drawer needs a stable endpoint, and the row may already be outside the filtered
page.
**How:** `LogController` route + `LogDetailSchema`; SuperAdmin-only, validate the id.

## 32. Export logs (CSV / JSON)

**What:** `GET /logs/export?filters` → CSV/JSON download.
**Why:** compliance requests, offline analysis, handing a debugging session to someone else.
**How:** reuse the same `LogQuerySchema`; stream or cap at N rows (e.g. 10k) with a clear note.

## 33. Webhook/slack-style digest (optional, internal)

**What:** a cron that emails/notifies the team when error counts spike (e.g. `errorGroup` count
threshold in 5 min).
**Why:** Datadog alerts, self-hosted — the minimum viable alerting.
**How:** `TaskScheduleService` job → aggregate `Log` by errorGroup over the window → if over
threshold, use the email system (see [email.md](./email.md)) to send an `ErrorDigest` email.

## 34. Log rotation for the `Log` table at write time too

**What:** beyond the retention cron (item 19), archive errorGroup+count aggregates so "top 20
errors" queries don't scan the whole table.
**Why:** dashboard latency on large log tables.
**How:** a nightly `LogErrorGroupSummary` table (errorGroup, count, lastSeenAt) upserted by the
cron — the dashboard reads the summary, not raw rows.

## 35. Request/response body logging (opt-in, sanitized)

**What:** log the request body + response `data` for chosen endpoints (e.g. auth) at debug
level, sanitized (item 17).
**Why:** reproducing "the exact payload that failed" is often the only way.
**How:** `ResponseInterceptor` already captures `request.responseData` — log it at debug when
`LOG_BODIES=true`, always through `sanitizeMetadata`.

## 36. User-facing "last errors" on the profile/settings (optional)

**What:** a "recent activity / errors on your account" list on the web app.
**Why:** support-self-service ("why did my action fail?") without admin intervention.
**How:** `GET /logs/me?limit=20` — scoped to the caller's `userId`, returns non-sensitive
entries only (never metadata containing PII).

## 37. Consistent message conventions

**What:** verb-first, noun-second messages ("Failed to send password reset email", not
"Password reset email send failure").
**Why:** log messages become the filter key; consistency makes grep + grouping work.
**How:** document the convention in this doc + a lint-friendly style note; audit existing
call sites.

## 38. `LogService` as the **only** logging API (kill raw `console`/`Logger`)

**What:** grep the codebase for stray `console.log` / `new Logger(...)` and route them through
`LogService` (the RbacService already has its own `Logger` — migrate it).
**Why:** one entry point = one format = one place to add sanitization/sampling.
**How:** keep Nest's internal logs (bootstrap) as-is; migrate app-level call sites.

## 39. `fatal` on uncaughtException/unhandledRejection

**What:** process-level handlers that log fatal + flush the queue before exit.
**Why:** a crash with no log is the worst failure mode.
**How:** `process.on("uncaughtException"...)` → `LogService.fatal` + flush queue + exit code 1.

## 40. Doc + runbook

**What:** a section in this file that grows as items land: env vars, query examples, "how to
find X" recipes.
**Why:** a junior must be able to operate the system (rule 14).
**How:** each item, once shipped, gets a ✅ and its recipe appended below.

_Last updated: 2026-08-05._
