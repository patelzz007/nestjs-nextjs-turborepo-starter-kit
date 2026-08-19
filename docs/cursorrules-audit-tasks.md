---
title: "Cursorrules audit — task reference"
description: "Actionable improvement tasks from the full-repo audit against .cursorrules. Pick a section, ship a small PR, tick the checkbox."
author: "Acme Inc."
lastUpdated: 1787097600000
coverImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80"
tags: ["audit", "cursorrules", "typesafety", "rls", "ui", "tasks"]
---

# Cursorrules audit — task reference

Use this doc when you want to **start a specific improvement task**. It is organized by priority and area, with file paths, which `.cursorrules` items each task touches, and a suggested fix.

**Related docs**

- [Improvement backlog](./improvement-backlog.md) — numbered backlog (100+ items), historical P0 “done” notes
- [Prisma & RLS](./prisma.md) — migration workflow, `db:reset`, RLS
- [`.cursorrules`](../.cursorrules) — source of truth for rules

**How to use**

1. Pick a **Quick win** or a **P1** slice (one PR per slice).
2. Read the **Rules** column — those are the `.cursorrules` / 25-rule items you must satisfy.
3. Run `pnpm typecheck` and `pnpm lint` for touched packages before merging.
4. Tick `[ ]` → `[x]` when done (commit the checkbox update with the PR).

**Severity**

| Level | Meaning |
|-------|---------|
| **P1** | Security, typesafety, RLS/auth holes — fix before production |
| **P2** | UI kit, smart/dumb split, tokens, CVA, RHF — quality bar |
| **P3** | Polish, comment drift, tests, file splits |

---

## Scorecard (vs `.cursorrules`)

| Area | Status | Notes |
|------|--------|-------|
| Data flow (Prisma → Zod → API → smart → dumb) | **Strong** on wired domains | Gaps: email/RBAC, some params |
| Type safety (no `any`/`unknown`/`never`/casts) | **Improved** in API | Production `apps/api` paths audited; telescope + email + backup clean; client/UI still have gaps |
| Access modifiers + return types | **Partial** | Auth/sessions/health loose |
| RLS | **Done** (first cut) | `prisma/rls.sql` + `pnpm db:rls`; `@RlsBypass()` for cross-tenant public DB routes |
| Dumb components (`forwardRef`, CVA, tokens) | **Early** | Largest remaining work |
| RHF + Zod forms | **Sparse** | Backup create/restore, settings |
| Documentation | **Good** Prisma/backup | Missing `packages/ui/README.md` |

---

## Already shipped (do not redo)

- [x] Backup schedule toggle, route order, retention prune, DB size SQL
- [x] `TELESCOPE_TOKEN` in global `AuthGuard`
- [x] `ScheduleModule.forRoot()` for cron jobs
- [x] RLS: `app_runtime`, policies, `RlsPool`, `RlsInterceptor`
- [x] Squashed init migration: `prisma/migrations/20260819105510_init/`
- [x] Standalone RLS: `prisma/rls.sql` + `pnpm db:rls` (runs after migrate/deploy/reset/push)
- [x] Auth P1: `@EmailVerified`, `@RequirePermission`, impersonation hardening, paginated admin users, dropped `User.refreshToken`
- [x] Telescope: replay SSRF guard, `LogService` instead of `console.warn`
- [x] Backup UI partial split (`backup-panel` + dumb pieces)
- [x] **Inline Zod → `packages/shared`** — full `apps/api` audit: runtime helpers, domain events, email template props, backup/telescope parse schemas moved to shared; API keeps helpers + `.parse()`/`safeParse()` only
- [x] **Schema vs type consumption** — app code imports `X` (type) for signatures; `XSchema` only at validation boundaries (pipes, DTOs, `.parse()`). No schema re-exports from services/templates/barrels
- [x] Shared `schemas/runtime/` — `json`, `caught-error`, `http-headers`, `prisma-query`, `primitives` (+ `JsonValueInput` for Prisma write helpers)
- [x] Shared `schemas/domain/events.ts` — `AuthFlowEvent`, `SessionActionEvent`, `ImpersonationActionEvent`, `EmailLogUpdatedEvent`
- [x] Shared `schemas/email/email-templates.ts` — all seven template prop schemas + `EmailRenderContext`
- [x] Swagger envelope factories — `createApiSuccessEnvelopeSchema` / `createApiSuccessArrayEnvelopeSchema` in `api-response.ts`; `response-wrapper.ts` delegates to shared

---

## Database & RLS workflow (read before DB tasks)

**Order (schema-first)**

1. Edit `apps/api/prisma/schema.prisma`
2. `pnpm db:migrate` (from `apps/api` or `pnpm db:migrate` from root) — applies migration **and** runs `db:rls`
3. Update Zod in `packages/shared`
4. Nest: `ZodValidationPipe` + Swagger wrappers
5. Client: `apiContract` leaf in `endpoints.ts`

**RLS is not in Prisma PSL.** Canonical SQL: `apps/api/prisma/rls.sql`. Applied via:

```bash
pnpm db:rls          # after migrate deploy / manual schema change
pnpm db:reset        # reset + rls + seed (from apps/api)
```

**Do not** squash to schema-only init — `app_runtime` needs `GRANT USAGE ON SCHEMA public` or API gets `42501 permission denied for schema public`.

**When adding a table**

- [ ] Add model + `/// RLS:` comment in `schema.prisma`
- [ ] Add table to the `FOREACH` array in `prisma/rls.sql` (if new table)
- [ ] Add policies in `rls.sql` for that table
- [ ] Run `pnpm db:migrate` or `pnpm db:rls` after push

---

## Quick wins (1–2 days each)

| # | Task | Files | Rules |
|---|------|-------|-------|
| Q1 | Admin guard on email log + preview (not just `AuthGuard`) | `email-log.controller.ts`, `email-preview.controller.ts` | 24 |
| Q2 | Point proxy refresh at contract path | `packages/client/src/lib/auth/proxy-refresh.ts` → use `apiRouter.auth.refresh.path` | Data flow | ✅ |
| Q3 | Wire 4 missing auth client routes | `packages/client/src/lib/api/endpoints.ts` — `forgotPassword`, `resetPassword`, `resendVerification`, `verifyEmail` | Data flow | ✅ |
| Q4 | Lift mutations out of dumb alerts panel | `apps/admin/components/telescope/alerts-panel.tsx` → parent passes `onAck` / `onSnooze` | 9–11, 19 |
| Q5 | Replace `z.unknown()` in success envelope | `packages/shared/src/schemas/api/api-response.ts` | 1–2 | ✅ |
| Q6 | `@EmailVerified()` on `stop-impersonation` | `impersonation.controller.ts` | 24 |
| Q7 | `GET /admin/users/:userId` + `@RequirePermission("READ", "USER")` | `auth.controller.ts` | 24 |

---

## P1 — Security & backend (`apps/api`)

### RLS & public routes

| Task | Where | Why | Fix |
|------|-------|-----|-----|
| [x] Audit Prisma calls on `@Public()` routes | `email-webhook.controller.ts`, `rls.interceptor.ts` | Full RLS bypass for request scope | `@RlsBypass()` on cross-tenant public DB routes only; refresh/logout stay scoped |
| [x] Document `@Public()` + bypass behavior | `docs/prisma.md` | Juniors will misconfigure new routes | Add table: which public routes touch DB |
| [ ] New table checklist | `schema.prisma`, `rls.sql` | Drift = missing policies | See **Database & RLS workflow** above |

### Permissions (`@RequirePermission`)

| Task | Where | Fix |
|------|-------|-----|
| [x] Register or document `PermissionGuard` usage | `app.module.ts` | Today only 2 `@RequirePermission` usages on auth controller |
| [x] Telescope destructive ops | `telescope.controller.ts` | Add resource permissions or document admin-only as intentional |
| [x] Backup mutations | `backup.controller.ts` | Align with `SYSTEM_SETTINGS` / admin dashboard perms |
| [x] Email admin surfaces | `email-log.controller.ts`, `email-preview.controller.ts` | **Q1** — dedicated admin guard + permissions |

### API boundary — `ZodValidationPipe` + shared contract

| Route / input | File | Fix |
|---------------|------|-----|
| [x] `POST /verify-email/:token` | `auth.controller.ts` | `VerifyEmailTokenParamSchema` (same field as `apiContract.auth.verifyEmail.input`) |
| [x] `GET/PATCH /admin/users/:userId` | `auth.controller.ts` | `UuidParamSchema` on `userId` |
| [x] `POST /impersonate/:userId` | `impersonation.controller.ts` | `UuidParamSchema` on `userId` |
| [x] Telescope `@Param("id")` routes | `telescope.controller.ts` | `TelescopeIdParamSchema` (contract `TelescopeIdInputSchema` uses same schema) |
| [x] Email log list query | `email-log.controller.ts` | `EmailLogListQuerySchema` + `apiContract.email.logList.input` |
| [x] Email preview `:key` | `email-preview.controller.ts` | `EmailTemplateKeyParamSchema` |
| [x] Resend webhook body | `email-webhook.controller.ts` | `ResendWebhookHeadersSchema` + `ResendWebhookEventSchema` after verify |

### Type safety — move schemas to `packages/shared`

| Schema today in API | File | Target |
|---------------------|------|--------|
| [x] JWT access/refresh payloads | `token.service.ts` | `packages/shared/src/schemas/auth/token.ts` |
| [x] RBAC user/permission shapes | `rbac.interface.ts` (deleted `rbac/schemas/user.schema.ts`) | `packages/shared` |
| [x] Cookie result | `cookies.service.ts` | `packages/shared/src/schemas/auth/cookies.ts` |
| [x] Email log create | `email-log.service.ts` | `packages/shared/src/schemas/email/email.ts` |
| [x] Response envelope helpers | `response.interceptor.ts` | `PaginatedServiceResultSchema` + `DataValueSchema` from shared |
| [x] Inline `z.string()` / `z.record()` in utils | `caught-error.ts`, `http-headers.ts`, `prisma-query-events.ts`, `main.ts`, telescope `sanitize.ts` / `pii-scanner.ts` | `schemas/runtime/*` + `TelescopeJsonObjectSchema` / `TelescopeJsonScalarSchema` |
| [x] Event bus payloads | `auth-events`, `sessions-events`, `impersonation-events`, `email-log-events` services | `schemas/domain/events.ts` |
| [x] Email template props | seven `*.template.ts` files | `schemas/email/email-templates.ts` |
| [x] Backup SQL row shapes | `backup.service.ts` | `schemas/domain/backup.ts` (`BackupDownloadTokenPayloadSchema`, table-name count rows) |
| [x] Log service options | `logs.service.ts` | `LogServiceOptionsSchema` in `schemas/domain/logs.ts` |
| [ ] Prisma `InputJsonValue` bridge | `common/utils/prisma-json.ts` | Stays in API (`z.custom` depends on `@prisma/client`) — params typed via shared `JsonValueInput` |

**Intentionally still in API (not portable to shared):**

- `common/utils/prisma-json.ts` — Prisma-specific `z.custom<Prisma.InputJsonValue>`
- `common/dto/response-wrapper.ts` — thin NestJS `createZodDto` wrapper (schemas live in shared factories)
- `*.spec.ts` — local test fixtures

### Type safety — schema vs type consumption (apps)

| Rule | Status | Notes |
|------|--------|-------|
| [x] Import **types** for signatures, props, return types | `apps/api` | e.g. `ImpersonationActionEvent`, `EmailRenderContext`, `JsonValue` |
| [x] Import **schemas** only at validation boundaries | `apps/api` | `ZodValidationPipe`, `createZodDto`, `.parse()` / `.safeParse()`, enum `.options` |
| [x] No `*Schema` re-exports from services/templates | `apps/api` | Event services, email templates, `cookie.config`, `json.ts`, `email-render-context.ts` export types only |
| [x] Event emitters validate before publish | `auth.service`, `sessions.service`, `impersonation.service` | `AuthFlowEventSchema.parse({…})` etc. — subscribers (Telescope adapters) always get contract-valid payloads |
| [x] Docs | `docs/typescript.md` §8 | Consumption rule + web import example uses `type LoginInput` |
| [x] `apps/web` | — | No `@workspace/shared` schema imports (nothing to change) |
| [x] `apps/admin` | — | Schema imports only for `parse`/`safeParse` on list queries + SSE frames; local app schemas still define `export type X = z.output<typeof XSchema>` in the same file |

### Type safety — eliminate banned patterns in production API

| Pattern | Files (start here) |
|---------|-------------------|
| [x] `unknown` | `zod-validation.pipe.ts`, `token.service.ts`, `email-webhook.controller.ts`, `email-sender.service.ts`, `main.ts`, `health.controller.ts`, `backup.service.ts` |
| [x] `never` | `backup.service.ts`, `email-sender.service.ts` |
| [x] `as` casts | `telescope-postgres.store.ts`, `telescope-prisma-listener.ts`, email template `as const` accents |
| [x] `typeof` instead of Zod | `email-webhook.controller.ts`, `set-auth-cookies.interceptor.ts`, `main.ts`, `backup.service.ts` |

### ESLint

| Task | Where | Fix |
|------|-------|-----|
| [ ] Tighten `no-unsafe-*` | `apps/api/eslint.config.js` | Today off for all `src/modules/**`; scope per module like telescope |
| [ ] Explicit access modifiers | `auth.service.ts`, `sessions.service.ts`, `impersonation.service.ts`, `token.service.ts`, controllers listed in audit | Add `public`/`private` on methods |

### Ops / scale (backup + telescope)

| Task | Where | Fix |
|------|-------|-----|
| [ ] Document single-replica constraint | `docs/backup.md`, `docs/telescope.md` | Queue, rate limits, circuit breaker are in-memory |
| [ ] Or: persist queue/state | `backup.service.ts` | Redis / DB job table |
| [ ] Empty `catch` blocks | `backup.service.ts` | `logs.warn` at minimum |
| [ ] User-controlled `--exclude-table-data` | `backup.service.ts` | Allowlist via `information_schema` |
| [ ] Stable error codes to clients | `response.interceptor.ts` | No raw `Error.message` in public body |
| [ ] Backup unit tests | `apps/api` | Prune math, route order, rate limit, redact |
| [ ] Align stale comments | `backup.service.ts`, docs | Remove references to `backup_events`, `pg_basebackup` if absent |

### Large files — split candidates

| File | ~Lines | Suggested split |
|------|--------|-----------------|
| [ ] `backup.service.ts` | 1,478 | dump / restore / scheduler / prune modules |
| [ ] `telescope.store.ts` | 1,092 | read models vs write/capture |
| [ ] `auth.service.ts` | 852 | already split sessions/impersonation — trim auth.service further |
| [ ] `telescope-postgres.store.ts` | 676 | list queries vs detail |
| [ ] `telescope.service.ts` | 563 | overview vs admin mutations |

### Duplicate patterns to consolidate

| Pattern | Locations |
|---------|-----------|
| [ ] Admin access guard | `backup-admin.guard.ts`, `telescope-admin.guard.ts`, `super-admin.guard.ts`, `backup.controller.ts` `requireAdminAccessToken` |
| [ ] `secureEquals` | `auth.guard.ts`, `telescope-admin.guard.ts` |
| [x] `ThrownErrorSchema` for errors | `rls-pool.ts`, `backup-scheduler.service.ts`, `backup.service.ts` | Shared `schemas/runtime/primitives.ts` |
| [x] Thin Swagger DTO wrappers | `apps/api/src/common/dto/response-wrapper.ts` | Envelope shape in shared; wrapper only calls `createZodDto` |

---

## P1 — Shared & client (`packages/shared`, `packages/client`)

### `packages/shared`

| Task | File | Fix |
|------|------|-----|
| [x] Remove `z.unknown()` from envelope | `schemas/api/api-response.ts` | `DataValueSchema` recursive union in `common.ts` |
| [x] Single `ApiVersion` source | `contracts/versioning.ts` + `schemas/api/version.ts` | `version.ts` imports `ApiVersion` type from `versioning.ts` |
| [x] `z.infer` → `z.output` | `schemas/api/env.ts`, `schemas/domain/logs.ts` | Consistency |
| [x] `as const` → tuples | `contracts/versioning.ts`, `contracts/index.ts` | Tuple annotations; `apiContract` no longer ends with `as const` |
| [x] `schemas/runtime/` barrel | `json`, `caught-error`, `http-headers`, `prisma-query`, `primitives` | API utils import from shared; no inline `z.string()` in production API |
| [x] Domain events + email template props | `domain/events.ts`, `email/email-templates.ts` | Event bus + seven email templates |
| [x] Swagger envelope factories | `createApiSuccessEnvelopeSchema`, `createApiSuccessArrayEnvelopeSchema` | `api-response.ts`; `response-wrapper.ts` is a thin Nest wrapper |
| [x] `JsonValueInput` | `schemas/runtime/json.ts` | Prisma JSON write helpers type params without `z.input<typeof …>` in API |

### `packages/client`

| Task | File | Fix |
|------|------|-----|
| [x] Missing router leaves | `lib/api/endpoints.ts` | **Q3** — four auth routes (+ server/client caller trees) |
| [x] Hardcoded refresh URL | `lib/auth/proxy-refresh.ts` | **Q2** — `apiContract.auth.refresh.path` |
| [x] JWT parsing without `unknown` | `lib/auth/jwt.ts` | `JwtPayloadSchema` in shared; `decodeJwtPayload` returns `JwtPayload \| null` |
| [x] Auth errors | `lib/auth/auth-errors.ts` | Zod schemas (`ApiErrorBodySchema`, `AccountLockedErrorSchema`) replace `typeof` |
| [x] Duplicate envelope interface | `lib/api/endpoints.ts` `Envelope<Data>` | Moved to `schemas/api/api-response.ts`; client imports type |
| [x] Client `ApiErrorSchema` drift | `lib/api/use-api.ts` | Re-exports shared `ApiErrorBodySchema` as `ApiErrorSchema` |

**Contract coverage:** 56/56 leaves wired (was 52/56).

---

## P2 — UI kit (`packages/ui`)

### Package-wide

| Task | Rules | Fix |
|------|-------|-----|
| [ ] Add `packages/ui/README.md` | 14 | Controlled API, theming, a11y, RHF `register` / `Controller` |
| [ ] Optional `react-hook-form` peer | 18 | Document in README |
| [ ] ESLint/contract: interactive roots need `forwardRef` | 20 | CI or lint rule |
| [ ] CVA on all styled components: `variant`, `size`, `state` | 23 | `state`: default \| loading \| disabled \| error |
| [ ] No English defaults in dumb components | 11 | Required `labels` prop maps |
| [ ] Tokenize z-index | 22 | `--z-overlay`, `--z-popover`, `--z-toast`; ban raw `z-50` |
| [ ] Ban `unknown`/`never`/`assumeType` at UI boundaries | 1–3 | Zod for persisted prefs, cell values |
| [ ] Ban inline object/array props | 16 | Module constants + `useMemo` |

**Coverage (approx.):** ~37/74 files use `forwardRef`; ~16/74 use `cva()`; ~7 use `React.memo`.

### `forwardRef` gaps (priority)

- [ ] `display/table.tsx`, `display/data-table.tsx`
- [ ] `feedback/spinner.tsx`, `feedback/skeleton.tsx`
- [ ] `navigation/tabs.tsx`, `navigation/pagination.tsx`, `navigation/scroll-area.tsx`
- [ ] `overlay/popover.tsx`, `overlay/sheet.tsx`, `overlay/command.tsx`, `overlay/menubar.tsx`
- [ ] `display/chart.tsx`, `display/calendar.tsx`, `display/kbd.tsx`
- [ ] `feedback/progress.tsx`, `feedback/message.tsx`, `feedback/not-found-content.tsx`
- [ ] `form/lockout-countdown.tsx`, `layout/auth-layout.tsx`

### CVA + form `state` variant

- [ ] `form/input.tsx`, `textarea.tsx`, `checkbox.tsx`, `switch.tsx`, `slider.tsx`
- [ ] `form/button.tsx` — add `state: loading | disabled | error` + spinner
- [ ] `form/select.tsx`, `combobox.tsx` — unified `state` in CVA

### Hardcoded colors → tokens

| File | Examples to replace |
|------|---------------------|
| [ ] `display/data-table.tsx` | `bg-blue-50`, `bg-green-100`, `bg-red-100`, print hex |
| [ ] `layout/auth-layout.tsx` | `bg-slate-900`, `bg-emerald-500` |
| [ ] `form/lockout-countdown.tsx` | `border-amber-500`, `text-amber-700` |
| [ ] `navigation/sidebar.tsx` | `data-active:bg-slate-800`, `text-white` |
| [ ] `display/chart.tsx` | `#ccc`, `#fff`; `theme?: never` → Zod discriminated union |

### `data-table.tsx` (2,334 lines)

- [ ] Replace `unknown` / `never` / `assumeType` in memo/export/persist paths
- [ ] Zod for `localStorage` prefs and cell values
- [ ] Required `labels` prop (Search, No data, Select all, export formats)
- [ ] Lift persistence/selection to smart parent or inject storage adapter
- [ ] Extract CSV/PDF/Excel exporters to separate modules
- [ ] `forwardRef` + CVA on table shell

### Other UI items

- [ ] `overlay/alert-dialog.tsx` — fully controlled; parent uses RHF + Zod; no default OK/Delete strings
- [ ] `form/form-shell.tsx` — no hardcoded Submit/Submitting; use `Spinner`
- [ ] `form/select.tsx` / `combobox.tsx` — move `sessionStorage` to parent
- [ ] `layout/auth-layout.tsx` — domain copy via props; consider move to apps
- [ ] `tokens.css` — `--background` hex outlier; add overlay z-index tokens

---

## P2 — Admin app (`apps/admin`)

### Telescope

| Task | File | Fix |
|------|------|-----|
| [ ] Dumb panel, smart parent | `components/telescope/alerts-panel.tsx` | **Q4** |
| [ ] Tokenize tone maps | `lib/telescope.ts`, `stat-card.tsx`, `exception-card.tsx`, `webhook-deliveries.tsx` | Semantic tokens + CVA `accent` |
| [ ] Split oversized pages | `overview.tsx` (~532), `requests-table.tsx` (~783), `request-detail.tsx` | One smart container; dumb tables |
| [ ] searchParams parsing | `requests/page.tsx` | Zod, not `typeof value === "string"` |
| [ ] Memo list rows | `exception-card.tsx`, `stat-card.tsx`, `live-feed.tsx` pattern | `React.memo` on hot paths |
| [ ] Drop `as const` on query defaults | telescope `page.tsx` | Tuples / `satisfies` |

### Backup

| Task | File | Fix |
|------|------|-----|
| [ ] RHF + Zod on create/restore | `backup-panel.tsx`, forms | `BackupCreateInputSchema`, `BackupRestoreInputSchema` |
| [ ] Status/schedule pills | backup components | CVA + semantic tokens, not `bg-emerald-100` |
| [ ] Export `BackupScheduleSchema` from shared | avoid local interface duplicate |
| [ ] Copy maps from page | `STAGE_LABELS`, `ERROR_CODE_COPY` | i18n-ready props |
| [ ] Finish split | `backup-panel.tsx` (~480) | dumb cards/table/dialogs complete |

### Auth / settings / users

| Task | File | Fix |
|------|------|-----|
| [ ] Demo accounts from server page | login views | Env flag; no passwords in client bundle |
| [ ] Login searchParams | auth pages | Zod |
| [ ] General settings fake data | settings pages | RHF + Zod; data from page/API |
| [ ] User detail fabricated email | user detail page | Real API; URL id ≠ authorization |
| [ ] Code block hex chrome | `components/docs/code-block.tsx` | Theme tokens light+dark |

### Showcase / gallery (lower priority)

- [ ] Move demo data to server `page.tsx` — `ChartAreaInteractive`, `DataTableShowcase`, combobox/select showcases

---

## P2 — Web app (`apps/web`)

| Task | File | Fix |
|------|------|-----|
| [ ] Split hello page | `app/hello/hello-view.tsx` | Smart `page.tsx` + dumb `HelloProfileView` props-only |
| [ ] Badge colors + dark mode | `hello-view.tsx` | Tokens, not `bg-green-100` without `dark:` |
| [ ] Login all-client + demo copy | `app/auth/login/page.tsx` | Mirror admin server-page pattern |
| [ ] Signup/forgot stubs | auth routes | Shared `AuthLayout` + copy props |

---

## P2 — Docs (`apps/docs`)

| Task | Fix |
|------|-----|
| [ ] `typeof` in searchParams / tree parsers | Zod at boundary |
| [ ] Lightbox / code chrome | Theme tokens |

---

## P3 — Polish & hygiene

| Task | Where |
|------|-------|
| [ ] Mark stale items done in `improvement-backlog.md` | `docs/improvement-backlog.md` |
| [ ] Update `schema.prisma` RLS header to reference `rls.sql` not old migration name | `prisma/schema.prisma` |
| [ ] Prisma 7 query events blind spot | Document in `docs/telescope.md` |
| [ ] Proxy tests typed doubles | `apps/admin/proxy.test.ts` — no `as unknown as` |
| [ ] Domain APIs without client contract | RBAC, menu, tags, URL, clicks — track if/when exposed |

---

## Recommended implementation order

```text
Phase 1 — Security & contracts (P1)
  Q1 → Q2 → Q3 → Q5 → Q6 → Q7
  Email webhook Zod + ZodValidationPipe
  Move JWT/RBAC schemas to shared

Phase 2 — API typesafety (P1)
  Eliminate unknown/never/casts in hot paths
  Tighten eslint no-unsafe-* per module
  ZodValidationPipe on remaining params

Phase 3 — UI foundation (P2)
  forwardRef on top-used primitives
  CVA state on Input/Button/Textarea
  Tokenize data-table + telescope tones
  alerts-panel mutation lift (Q4)

Phase 4 — Forms & splits (P2)
  Backup RHF
  Split data-table / backup.service / requests-table
  packages/ui README

Phase 5 — Ops (P1/P3)
  Document or fix multi-replica backup/telescope
  Backup unit tests
```

---

## Task index by file (grep-friendly)

<details>
<summary><code>apps/api</code></summary>

- `auth.controller.ts` — ZodValidationPipe params, `@RequirePermission` on get user
- `impersonation.controller.ts` — param validation, `@EmailVerified` on stop
- `email-log.controller.ts`, `email-preview.controller.ts` — admin guard
- `email-webhook.controller.ts` — Zod body, minimize DB on public route
- `telescope.controller.ts` — param pipes, `@EmailVerified` on destructive ops
- `backup.service.ts` — split, tests, catch logging, allowlist excludes
- `token.service.ts` — move schemas to shared, remove `unknown` in catch
- `zod-validation.pipe.ts` — typed without `unknown` if possible
- `response.interceptor.ts` — stable client errors
- `eslint.config.js` — tighten unsafe rules
- `prisma/schema.prisma` — RLS comments per model
- `prisma/rls.sql` — canonical policies

</details>

<details>
<summary><code>packages/shared</code></summary>

- `schemas/api/api-response.ts` — no `z.unknown()`
- `contracts/versioning.ts` — tuples, single ApiVersion
- Move auth/RBAC/JWT schemas from API here

</details>

<details>
<summary><code>packages/client</code></summary>

- `lib/api/endpoints.ts` — 4 auth leaves, envelope type
- `lib/auth/proxy-refresh.ts` — contract path
- `lib/auth/jwt.ts`, `auth-errors.ts` — Zod parsing

</details>

<details>
<summary><code>packages/ui</code></summary>

- `display/data-table.tsx` — largest hotspot
- `form/*` — CVA state, forwardRef
- `layout/auth-layout.tsx` — tokens, props
- `README.md` — create

</details>

<details>
<summary><code>apps/admin</code></summary>

- `components/telescope/alerts-panel.tsx`
- `lib/telescope.ts`
- `app/(panel)/backup/backup-panel.tsx`
- `app/(panel)/telescope/**` — splits, Zod searchParams

</details>

<details>
<summary><code>apps/web</code></summary>

- `app/hello/hello-view.tsx`
- `app/auth/login/page.tsx`

</details>

---

_Last updated: August 19, 2026. Regenerate sections after large refactors by re-auditing against `.cursorrules`._
