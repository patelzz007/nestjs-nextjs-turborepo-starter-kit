---
title: "Improvement backlog"
description: "Full-repo audit against the 25 non-negotiable engineering rules. Written so a junior engineer can understand what is broken, why it matters, and what to do next."
author: "Acme Inc."
lastUpdated: 1786972800000
coverImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80"
tags: ["audit", "typesafety", "rls", "ui", "backup", "telescope"]
---

# Improvement backlog

This document is a **complete audit** of the monorepo against the 25 non-negotiable rules (typesafety, smart/dumb split, CVA, refs, theming, RLS, and so on). It is **not** a promise that every item will be done in one PR. Use it as a backlog: pick a P0, ship a small PR, tick it off.

**How to read an item**

- **Where** — file or package
- **Rule** — which of the 25 rules it breaks
- **Why it matters** — what goes wrong for users or for the next engineer
- **Fix** — the straightforward next step (rule 25: do not overthink)

**Severity**

- **P0** — security, data loss, or a feature that does not work
- **P1** — typesafety / RLS / auth holes that will bite in production
- **P2** — smart/dumb, tokens, CVA, RHF — quality bar
- **P3** — polish, docs drift, split giant files

---

## The 25 rules (short)

1. No `any` / `z.any`
2. No `unknown` / `z.unknown`
3. No `never` / `z.never`
4. No type casting; no `as const` — use tuples
5. Avoid `typeof`; infer from Zod
6. Generics first
7. Production-ready UI
8. Mobile responsive
9–11. Data and copy live in the smart layer (`page.tsx`); dumb components take props, no hardcoded domain strings
12. Do not change layout unless asked
13. No `typeof x === "string"` etc. — Zod instead
14. Update docs when you ship
15. Access modifiers + explicit return types always
16. Memoize; no inline object/array props
17. Light and dark theme
18. Forms: React Hook Form + Zod; no internal validation in dumb components
19. Dumb components: stateless, accessible, composable, themeable, parent-controlled
20. `forwardRef` on every interactive/root node
21. Consistent `onBlur` / `onChange` / `onFocus`
22. Design tokens only — no magic Tailwind (`z-50`, `bg-emerald-100`, hex)
23. CVA: `variant`, `size`, `state` (`loading` | `disabled` | `error`)
24. Row Level Security on the database (backend)
25. Straightforward solution; keep autocomplete

---

## P0 — shipped 2026-08-18

### 1. Backup schedule toggle is a dead button — **done**

- Admin now calls `api.backup.toggleSchedule.useMutation()` (typed contract + Nest
  `POST /backup/schedules/:id/toggle`). Raw `fetch` to the Next origin is gone; errors
  surface instead of a fake success toast.

### 2. Nest `GET /backup/:id` steals `GET /backup/schedules` — **done**

- Static paths `options`, `schedules`, and `schedules/:id/toggle` sit **above** `:id`.

### 3. Backup retention prune waits twice as long — **done**

- Prune uses `expiresAt: { lt: Date.now() }` (create still writes `now + retention`).

### 4. SQL string built from database name — **done**

- `SELECT pg_database_size(current_database())` — no interpolated name.

### 5. `TELESCOPE_TOKEN` cannot pass global `AuthGuard` — **done**

- AuthGuard compares Bearer to `TELESCOPE_TOKEN` (SHA-256 + `timingSafeEqual`) **before**
  JWT verify. `TelescopeAdminGuard` still gates `/telescope/*`.

### 6. Auth `@Cron` never runs — **done**

- `ScheduleModule.forRoot()` is imported in `AppModule`. Password-reset cleanup hourly.

### 7. No Postgres Row Level Security — **done** (first cut)

- Role `app_runtime` + `FORCE ROW LEVEL SECURITY` + policies. API pool `SET ROLE` +
  session vars from `RlsInterceptor` ALS. Documented in `docs/prisma.md` §10.
  Replay `20260818235200_init` (schema + RLS tail) before starting the API.

---

---

## P1 — security / types / multi-instance

### Auth and permissions

8. **`EmailVerifiedGuard` is never applied** — **done.** `@EmailVerified()` on backup + impersonate + unlock.
9. **No `@RequirePermission` guard** — **done.** JWT check + `MANAGE` on resource; RBAC walks `parentId`, skips soft-deletes, applies unexpired `UserPermission`.
10. **Public `POST /users` signup alias** — **done.** Removed; signup is `POST /auth/signup` only.
11. **Impersonation** — **done.** Nested impersonation blocked; stop requires impersonation claims; audit log INSERT/SELECT only for `app_runtime`.
12. **`User.refreshToken` column** — **done.** Dropped (sessions use `RefreshToken`). Cookie name `refreshToken` unchanged.
13. **Admin user list is unbounded** — **done.** `GET /auth/admin/users` paginated (`AdminUserListQuerySchema` + `ZodValidationPipe`).

### Backup / ops

14. **In-memory queue, rate limits, circuit breaker, restore lock, cron** — lost on restart and wrong with two API replicas. Document “single replica” or move to Redis / DB / `@nestjs/schedule`.
15. **`getNextCronRun` ignores day-of-week** — **done.** `nextCronRunMs` honors DOW (UTC).
16. **`setInterval` disk monitors and scheduler** with no `OnModuleDestroy` — **done** for scheduler + disk monitors (`BackupSchedulerService` / `BackupService.onModuleDestroy`).
17. **User-controlled `--exclude-table-data=`** — allowlist against `information_schema`.
18. **Empty `catch` blocks** swallow disk/unlink/progress errors — at least `logs.warn`.
19. **Raw `Error.message` can reach clients** (`response.interceptor.ts`). Public body = stable codes; stacks stay in logs. `redact()` only covers URL/password patterns.
20. **Missing indexes:** `backups.expiresAt`, `backups.requestedBy`; telescope jobs/alerts filter columns.
21. **No backup unit tests.** Add: prune math, quoteIdent, route order, rate limit, cancel, redact.
22. **Comments claim `backup_events` table and `pg_basebackup`** — neither exists. Align comments/docs.

### Telescope

23. **In-memory store + scheduler** not multi-instance safe.
24. **Replay SSRF:** — **done** first cut: configured origins only, same-origin path join, private IPs blocked except `local`.
25. **`console.warn` in postgres store / retention / alerts** — **done.** `LogService`.
26. **Prisma 7 query events** may not fire with the driver adapter — document the blind spot.
27. **CLI `as T` on JSON** — **done.** Shared response schemas + envelope parse.

### Typesafety (repo-wide)

28. **`unknown` is common** (banned): `packages/ui` data-table + chart; `packages/client` jwt/auth-errors; `apps/api` Zod pipe / token catch; `packages/shared` `data: z.unknown()` in envelope.
29. **`never`:** chart exclusive union; data-table `memoGeneric`; some Promise races.
30. **Casts / `assumeType`:** `packages/ui/src/lib/utils.ts`; Prisma JSON in telescope stores.
31. **`as const`:** `packages/shared` `contracts/versioning.ts`, `apiContract`; client `endpoints.ts`; admin telescope `page.tsx` query defaults; email templates accents; docs sitemap.
32. **Runtime `typeof x === "string"`** instead of Zod: admin searchParams, slider, docs tree, client env checks, API headers.
33. **`explicit-member-accessibility` only on telescope.** Auth, Prisma, health, RBAC, pipes missing `public`/`private` (rule 15).
34. **API eslint turns off `no-unsafe-*` for all `src/modules/**`.** Tighten like the telescope override.
35. **JWT / RBAC / download-token schemas live in the API.** Move to `@workspace/shared`.

---

## P2 — UI system (`packages/ui`)

Counts from the audit: **0** `any`; **0** `as const`; **~18** `unknown`; **3** `never`; **~32/69** files missing `forwardRef`; **~53/69** missing CVA; **~9** CVA files have a `state` variant; **no package README**; **no `react-hook-form` peer**.

### Package-wide

36. Add `packages/ui/README.md` (rule 14): controlled API, theming, a11y, RHF `register` / `Controller`.
37. Optional `react-hook-form` peer (rule 18).
38. ESLint/contract test: every interactive root must `forwardRef` (rule 20).
39. Every styled component: `cva({ variant, size, state })` with `state: default | loading | disabled | error` (rule 23).
40. Required `labels` prop maps — **no English defaults** in dumb components (rule 11).
41. Tokenize z-index (`--z-overlay`, `--z-popover`, `--z-toast`). Ban raw `z-50` (~28 usages).
42. Ban `unknown` / `never` / `assumeType` / runtime `typeof` at UI boundaries — Zod instead.
43. Ban inline object/array props (rule 16) — module constants + `useMemo`.

### `data-table.tsx` (largest hotspot)

44. Replace `unknown` / `assumeType` / `never` in `memoGeneric` / `toCellString` / export / persist.
45. Zod for persisted prefs and cell values.
46. Required `labels` for Search / No data / Select all / export formats / “User Actions”.
47. Lift persistence and selection to the smart layer (or inject a storage adapter). Dumb table should not own `localStorage`.
48. Print CSS hex (`#1f2937`) → tokens. Action menu `text-gray-900` / `text-red-600` → `text-foreground` / `text-destructive`.
49. CVA + `forwardRef` on the table shell.
50. Extract CSV/PDF/Excel exporters out of the presentational component.

### `chart.tsx`

51. Replace `theme?: never` exclusive union with a Zod discriminated union.
52. Payload Zod schema instead of `typeof value === "object"`.
53. `#ccc` / `#fff` → tokens. `forwardRef` + CVA + aria.

### Forms

54. **Input / Textarea / Checkbox / Switch / Slider / Radio / NativeSelect / OTP / Label:** add CVA `variant` / `size` / `state`. Slider `bg-white` → token. Switch magic pixel sizes → tokens. Checkbox `rounded-[4px]` → radius token.
55. **Button:** CVA `state` including `loading` + spinner.
56. **FormShell:** no hardcoded “Submit” / “Submitting…”. Use `Spinner`. Error banner needs `aria-*`.
57. **PasswordInput:** labels via props; amber → `--warning`.
58. **PasswordStrengthMeter:** title via props; width via CSS variable.
59. **LockoutCountdown:** copy via props; not domain-coupled.
60. **Select / Combobox:** no English defaults; move `sessionStorage` persist to parent; compose refs without `typeof ref === "function"`; token `z-50`.
61. **Alert-dialog:** currently owns keyword/reason/remember/countdown `useState` — that is a form. Make it fully controlled; parent uses RHF + Zod. No default “OK/Delete/Cancel” strings. Add CVA.

### Overlay / navigation / feedback

62. Dialog / Sheet / Drawer overlays: `bg-black/10` vs token overlay — pick one token.
63. Drawer cubic-bezier arbitrary values → motion tokens.
64. Command default description hardcoded.
65. Sidebar: `data-active:bg-slate-800` / `text-white` bypass tokens; cookie persist is smart-layer work.
66. Pagination: “Previous”/“Next” via props; `forwardRef`; CVA.
67. Accordion `sessionStorage` + hash sync → parent.
68. Breadcrumb hardcoded validation copy; `typeof` in refine → icon schema.
69. Carousel / Tabs / Scroll-to-top: CVA, refs, no hardcoded Previous/Next, token `z-50`.
70. Toast / Alert: labels via props; z-index tokens; `text-[10px]` → type token.
71. Spinner: `aria-label` via props; `forwardRef`; CVA.
72. Not-found-content: no default “404” copy — all props.
73. Skeleton / Progress / Message: refs + CVA + aria.
74. Auth-layout in UI package is **domain-named** and hardcodes “Back to sign in” — rename or move to apps; copy via props.
75. Chat bubble / attachment: refs, CVA size/state, no `oklch(from_var(--primary)…)` arbitrary, aria.
76. Calendar: memoize `formatters` / `classNames`; `text-[0.8rem]` → token.
77. Theme provider: hotkey `"d"` should be opt-in prop.
78. `tokens.css`: `--background: #f9fafb` hex outlier; add overlay z-index tokens.

---

## P2 — Admin app

### Backup page (after the P0 toggle fix)

79. Split `backup-panel.tsx` — **started**: smart `backup-panel.tsx` owns queries/mutations; dumb cards/table/dialogs live beside it. RHF still outstanding.
80. Create + restore forms: **RHF + existing Zod schemas** (`BackupCreateInputSchema`, `BackupRestoreInputSchema`).
81. Status / schedule pills: CVA + semantic tokens (`success` / `warning` / `destructive`), not `bg-emerald-100`.
82. Quota bar: `Progress` or CSS variable, not inline `style={{ width }}`.
83. Copy maps (STAGE_LABELS, ERROR_CODE_COPY) passed from page (i18n-ready).
84. Export `BackupScheduleSchema` from shared (do not duplicate a local interface).
85. `typeof value === "number"` on slider → schema for slider output.
86. Memo row helpers; module-level icons (rule 16).
87. Do not put backup ids in toasts.

### Overview gallery / showcases

88. `page.tsx` is a one-line wrapper. Move FAQ, demo rows, chart series, jump-nav into the **server page**; gallery receives props.
89. `SectionCards` hardcoded stats → `cards` prop.
90. `ChartAreaInteractive` hardcoded `chartData` → props; drop `typeof value !== "string"`.
91. `DataTableShowcase` owns DEMO_ROWS — page should own them.
92. Combobox/Select/Alert/Toast/Accordion showcases: options and copy from page.
93. Status `"Done"` string check → Zod enum.
94. Skeleton heights hardcoded → size tokens / props.

### Telescope (admin)

95. Overview / tables are smart (queries + mutations). Keep one smart container; tables become dumb (data + callbacks).
96. `AlertsPanel` must not call mutations — parent passes `onAck` / `onSnooze`.
97. Drop `as const` on status segments and page query defaults (tuples / `satisfies`).
98. Requests `page.tsx` searchParams: Zod, not `typeof value === "string"`.
99. Hardcoded emerald/sky/amber/violet in StatCards, timeline, annotation star, `lib/telescope.ts` → tokens + CVA `accent`.
100. Filter option lists from shared enums, not inline arrays.
101. Memo cards/rows (SSE churn).
102. Replay/snooze: controlled + RHF if they are forms.

### Auth / settings / users / emails

103. LoginView copy + demo accounts from **server page** (env). Never ship demo passwords in a production client bundle.
104. Login searchParams: Zod.
105. Forgot-password stub: AuthLayout + copy props.
106. General settings: fake profile + `dataset.field` — RHF + Zod; data from page.
107. Billing: hardcoded plan/invoices → props + tokens.
108. User detail fabricates `${userId}@example.com` — real API; never invent PII; URL id is not authorization (rule 24).
109. Email templates `MODE_TABS` from page.
110. Code-block language dots assume dark chrome — light+dark tokens.
111. Palette / command palette / network bar / profile online dot: semantic tokens.
112. Proxy tests: typed doubles, not `as unknown as NextRequest`.

---

## P2 — Web, docs, client, shared

### `apps/web`

113. Login page is all-client; demo passwords in bundle — mirror admin (server page + env flag).
114. Hardcoded LinkHub copy → props.
115. Signup / forgot-password stubs: shared AuthLayout.
116. Hello badges `bg-green/yellow/purple` **without `dark:`** — tokens + dark variants.
117. Raw `user.id` in Account Details — hide or “advanced”.
118. Proxy test casts.

### `apps/docs`

119. `changeFrequency: "weekly" as const` → typed union / `satisfies`.
120. `typeof name === "string"` / `typeof structuredData === "function"` in page/tree/search — Zod adapters.
121. Callout hues + `bg-black/50` overlays → tokens / CVA kinds.
122. OG image hex map — one shared constant file (OG cannot use CSS vars).
123. Landing marketing copy → content module.

### `packages/client`

124. SSR prefetch `retries: 0` — retry **once** on network errors only; never retry 4xx. Stops the `[api-server] prefetch failed (network (fetch failed))` noise at `pnpm run dev` when the API is a second behind Next.
125. `endpoints.ts` `} as const` → `satisfies ApiRouter`.
126. `unknown` in jwt / auth-errors / proxy-refresh / login catch → Zod envelopes + `JwtPayloadSchema`.
127. **LoginForm: `useState` → RHF + `LoginSchema`.**
128. Social button brand hex — isolate or `currentColor`.
129. Do not print demo passwords in the DOM.
130. Add backup schedule mutation leaf when the contract exists.
131. `JSON.parse` pipeline: feed Zod, never `any`.

### `packages/shared`

132. `data: z.unknown()` in success envelope — generic `envelope<T>()`.
133. Named `BackupScheduleSchema` + toggle I/O; add `schedules` / `toggleSchedule` to `apiContract.backup`.
134. `API_VERSION` / route prefix / `apiContract` `as const` → tuples + `satisfies`.
135. Split `schemas/domain/telescope.ts` (~1k lines) by domain.
136. Shared `IdParamSchema` instead of repeating `{ id: z.string() }`.
137. Format: glued comments, overlong barrels (already partly cleaned in backup.ts).

---

## P3 — architecture / docs / tests

138. Split `BackupService` — **started**: pure helpers in `backup-utils.ts` (URL, df, quoteIdent, redact, timestamps). Dump/restore/scheduler still in the service.
139. Split telescope capture / read API / jobs / alerts / storage.
140. Soft-delete: Prisma middleware auto-`isDeleted: false`.
141. `PermissionAuditLog` missing FKs to User/Role/Permission.
142. Dual cookie names + Bearer — document audience rules.
143. Tests: impersonation, RBAC hierarchy, RLS policy rejection, sessions, backup admin 403, telescope disabled 404.
144. Specs that use `as unknown as` mocks → typed Nest testing doubles.
145. **Docs drift:** `docs/backup.md` missing schedule endpoints; `docs/prisma.md` silent on RLS; `docs/telescope.md` CLI auth wrong; `docs/getting-started.md` stops before rules 16–25; comment claims vs code (pg_basebackup, backup_events).
146. `packages/ui` has no consumer README (item 36).
147. Getting-started / AGENTS: publish backend RLS + “no unknown/never/as const” so new modules match telescope’s eslint override.

---

## Suggested order of work (small PRs)

P0 is done. Next: the **big piles** (types, UI kit, smart/dumb splits of giant files), then remaining P1 auth/ops.

1. Typesafety pile (P1 28–34): kill `unknown` / `never` / casts / `as const`; copy telescope eslint override.
2. Split giant files (P2 79, 95; P3 138–139): `backup-panel.tsx`, `BackupService`, telescope tables/capture.
3. UI kit (P2 36–78): `forwardRef`, CVA `state`, tokens instead of `bg-emerald-*` / `z-50`.
4. Auth follow-ups (P1 8–13): **done** (EmailVerified, `@RequirePermission`, signup alias, impersonation, drop `User.refreshToken`, paginated admin users).
5. LoginForm + backup forms → RHF + Zod.
6. Prefetch retry-on-network; tests for RLS rejection.

---

## What is already in good shape

- Typed `any` is rare in `packages/ui` (comments only).
- `as const` is already **zero** in `packages/ui`.
- Shared backup/telescope contracts exist and drive Nest + client (except schedules).
- Admin backup history table now uses the same DataTable chrome as Overview “Document sections” (filters, ⋯ actions, bulk, pinning, persist).
- Telescope eslint override already bans `any` / `unknown` / `never` — **copy that override** to other modules as they are cleaned.
- Many form controls already forward refs and thread `onBlur` / `onChange` / `onFocus`.
- Dark-mode tokens exist (`tokens.css`); the debt is **not using them** (raw Tailwind palettes).
