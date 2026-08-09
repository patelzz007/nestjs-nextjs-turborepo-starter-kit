---
title: "Email Template System"
description: "The 40 must-have items for the Resend-powered transactional email template system — each grounded in the current code."
order: 13
author: "Acme Inc."
lastUpdated: "2026-08-05"
coverImage: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&w=1600&q=80"
---

# Email Template System

> [!NOTE] A production-grade transactional-email layer on **Resend**. Every item states **what** it is,
> **why** it matters, the **current state** (verified against the code today), and **how** to
> implement it — written so a junior developer with ~6 months of experience can execute without
> guessing.
>
> **Ground truth** (checked 2026-08-05):
>
> - `apps/api/src/modules/auth/services/email.service.ts` sends 3 transactional emails via
>   **Resend v6** (`this.resend.emails.send(...)`) with **inline HTML + plain-text template
>   builders** (no template files, no preview, no tests).
> - Config comes from `TypedConfigService` (`resendApiKey`, `emailFromAddress`, `appName`,
>   `appUrl`).
>
> This system must follow the repo's non-negotiable rules: no `any`/`unknown`/`never`, no type
> casting, infer types from zod schemas, generic types first, explicit access modifiers + return
> types on every method, and structured zod-schema-driven payloads.
>
> **Related docs:** the logging system has its own guide — [Logging System](./logging.md).

---

# ✉️ Email Template System (Resend)

> [!NOTE] **The goal:** a production-grade transactional-email layer on **Resend** — real template files
> (no inline HTML strings), HTML + plain-text for every email, a preview workflow, and total
> control over content without touching code. `EmailService` stays the single send entry point.

## 1. Move templates out of the service into real files

**What:** today `email.service.ts` builds HTML with inline template-literal strings inside
`buildVerificationHtml`/`buildPasswordResetHtml`/`buildAccountLockedHtml`. Move each into its
own file (e.g. `apps/api/src/modules/email/templates/`).
**Why:** inline strings can't be previewed, tested, or edited without touching code, and they
blow up the service file.
**How:** a `templates/` folder with one `.tsx` or `.ts` file per email (see items 3–4 for the
format). Each exports a pure `render(props) → { html, text }` function.

## 2. A dedicated `EmailModule`

**What:** emails currently live inside `AuthModule` (`auth/services/email.service.ts`).
**Why:** auth shouldn't own email; a `POST /emails/test` admin endpoint (item 24) and the
preview pages (item 21) need a home outside auth.
**How:** create `apps/api/src/modules/email/` with `email.module.ts` (exports `EmailService`),
`email.controller.ts` (admin + internal routes), and `templates/`. Re-export `EmailService`
from auth for the migration window, then update imports.

## 3. HTML templates as React components (react-email) — or a strict HTML-file convention

**What:** the industry standard is [react-email](https://react.email) — React components that
render to bulletproof email HTML. Alternative: keep `.html` template files with a tiny
`{{variable}}` interpolator.
**Why:** email HTML is a minefield (Outlook + Gmail + dark mode); React components give
reusable `<Button>`/`<Container>` building blocks and auto-generate the plain-text version.
**How:** add `react-email` + `@react-email/components` to `apps/api`; each template is a
`<EmailTemplate />` component; `EmailService` calls `render(<VerifyEmail ... />)` to get
`{ html, text }`. If you prefer zero new deps: a `templates/*.html` + `templates/*.txt` pair
per email with `replaceAll("{{var}}", value)` — but you lose components.

## 4. Every email ships with a plain-text twin

**What:** `resend.emails.send({ html, text })` already gets `text` — but it's hand-written and
drifts from the HTML.
**Why:** text clients, screen readers, spam scoring — text version matters.
**How:** if react-email: `render(<T />, { plainText: true })` auto-generates it. Otherwise keep
pairs in sync with a test that asserts both mention the same key variables.

## 5. One `render` contract — every template is a pure function

**What:** every template exports `render(props): { html: string; text: string }` where `props`
is a zod-validated object.
**Why:** rules 9–13: data comes in typed via props; templates are dumb/pure; nothing hardcoded.
**How:** `EmailTemplatePropsSchema` per template (zod) — `render(schema.parse(props))`.

## 6. A template registry (map of name → renderer)

**What:** `EmailTemplateNameSchema` (zod enum: `welcome`, `verify-email`, `password-reset`,
`account-locked`, `email-changed`, …) and a `TEMPLATE_REGISTRY: Record<TemplateName,
TemplateRenderer>`.
**Why:** prevents drift between names used by callers and files on disk; gives a single place
to enumerate templates (preview, tests).
**How:** a plain object literal + a zod-validated name; a unit test asserts every enum value
has a renderer (completeness check).

## 7. Type-safe props per template

**What:** `sendPasswordResetEmail(email, resetToken)` becomes `send("password-reset", {
recipient, resetUrl })` — props typed by the registry.
**Why:** callers can't pass the wrong shape; refactors are caught at compile time.
**How:** `EmailService.send<Name extends TemplateName>(name: Name, props:
TemplatePropsMap[Name])` with a mapped type from the registry.

## 8. `send()` with a result object (never throw, never silent)

**What:** `EmailService.send(...)` returns a `SendEmailResult` (`{ ok: true, id } | { ok: false,
reason: "config" | "api-error" | "invalid-recipient", detail? }`) instead of `void` + internal
catch.
**Why:** today failures are swallowed to a log line — callers can't react (retry, alert).
**How:** keep the no-throw contract but surface the outcome; audit emails get the reason too
(ties into the logging doc's audit table).

## 9. `X-Entity-Ref-ID` / idempotency on send

**What:** Resend supports `idempotency_key` on send; pass one per logical email (e.g.
`reset-<userId>-<requestId>`).
**Why:** a retry after a timeout could otherwise send the same email twice.
**How:** `resend.emails.send({ ... , headers: { "X-Entity-Ref-ID": key } })`; generate the key
in the caller (the auth service already has a requestId/correlationId).

## 10. Retry with backoff for transient Resend failures

**What:** Resend 429/5xx should retry (e.g. 2 retries, 1s/4s backoff) before giving up.
**Why:** transactional emails are the reliability-critical path (password resets!).
**How:** a small `withRetry` wrapper in `EmailService` (bounded, logged); never retry on 4xx
except 429.

## 11. Proper `from` handling (verified domain + reply-to)

**What:** `emailFromAddress` is one string. Production needs a **verified sender domain** in
Resend and a distinct `replyTo` (e.g. `support@`).
**Why:** unverified senders get spam-foldered; `reply-to` routes replies to a real inbox.
**How:** env vars `EMAIL_FROM_NAME` + `EMAIL_FROM_ADDRESS` (verified in Resend) and
`EMAIL_REPLY_TO`; pass `replyTo` in every send; document the Resend domain-verification step in
`.env.example`.

## 12. Recipient validation before send (zod email)

**What:** validate `recipient` with `z.string().email()` before calling Resend.
**Why:** a garbage address costs a failed API call + a noisy log line, and can mark the sender
as spammy.
**How:** `EmailService.send` parses the recipient through `EmailRecipientSchema` and returns
`{ ok: false, reason: "invalid-recipient" }` on failure.

## 13. BCC/audit copy for transactional emails (optional, env-gated)

**What:** `EMAIL_AUDIT_BCC` env (comma-separated) — every send gets a blind copy.
**Why:** compliance / debugging ("what exactly did the user receive?").
**How:** spread the list into `bcc` in the send payload; empty env = no BCC.

## 14. Every send logged through `LogService` (already done — harden it)

**What:** `EmailService` already logs sent/failed — but with no `userId`/`correlationId` and
with raw `to`.
**Why:** you need to answer "which user, which request, which email" per send.
**How:** accept `{ userId?, correlationId? }` in the send context and pass to `LogService`
(ties into the logging doc — after its item 5 lands, correlationId arrives automatically).

## 15. Email audit table (`EmailLog`)

**What:** a Prisma `EmailLog` model: `{ id, template, to, userId?, status, resendId?,
errorReason?, sentAt }`.
**Why:** the audit trail for "what email went where and did it deliver" — distinct from generic
logs; the seeds/auth roadmaps already call for an audit log.
**How:** mirror the auth-audit-log pattern (auth-roadmap item 15); write in `EmailService`
after each send result; `GET /admin/emails` to view (SuperAdmin).

## 16. Resend webhook → delivery status

**What:** Resend can POST delivery events (sent, delivered, bounced, complained, failed) to an
endpoint. Build `POST /emails/webhook` and record status on `EmailLog`.
**Why:** knowing an email **bounced** (bad address) or **wasn't delivered** is critical for
password resets — "the user never got the link" is a support ticket.
**How:** `POST /emails/webhook` (signature-verified via Resend's `WEBHOOK_SECRET`, public but
unthrottled with verification); map events to `EmailLog.status`; log anomalies (bounce → warn).

## 17. Webhook signature verification

**What:** Resend signs webhook payloads (`Resend-Signature` header + timestamp).
**Why:** anyone could POST fake events to poison the audit trail.
**How:** verify `crypto.createHmac("sha256", WEBHOOK_SECRET)` over the body (Resend's documented
scheme); reject mismatches with 401 before touching the DB.

## 18. Email cooldown / rate control (per user, per template)

**What:** a per-recipient cooldown (e.g. min 60s between same-template emails; max 5
verification/reset emails per 24h per user).
**Why:** anti-abuse — a bot hitting `/auth/forgot-password` would otherwise spam a victim's
inbox (auth-roadmap item 11 already calls for this).
**How:** check `EmailLog` counts before send; skip + log `EMAIL_COOLDOWN` when exceeded (still
return the caller's success message — anti-enumeration).

## 19. Email verification is **not** required for login (document + keep)

**What:** the app currently lets unverified users log in (`isEmailVerified` is informational).
**Why:** this is a product decision — but the email system must support flipping it later
(auth-roadmap item 6).
**How:** keep the gate toggle (`REQUIRE_EMAIL_VERIFICATION` env) in one place; the login form
shows "verify your email" when the flag is on.

## 20. Dark-mode + client-compatible HTML

**What:** the current inline HTML has hardcoded colors and no `prefers-color-scheme` handling.
**Why:** emails render differently on dark-mode clients and mobile; a broken layout erodes
trust.
**How:** if react-email: its components handle this. Otherwise: add `@media (prefers-color-scheme: dark)` overrides + `color-scheme: light dark` meta; keep colors on brand tokens; test in
Gmail + Apple Mail.

## 21. Admin preview page (`/emails/preview`)

**What:** a SuperAdmin page listing every template with sample data, rendering the HTML in an
iframe + the text version.
**Why:** the "preview without sending" workflow — the whole point of moving templates out of
code; lets non-devs edit content (item 22).
**How:** `GET /admin/emails/preview/:template` renders sample props; low-level `EmailPreview`
component takes `{ html, text }` props (rules 9–11) — no data logic inside.

## 22. Templates editable at runtime (DB-stored) or file-based? — decide

**What:** auth-roadmap's older "email template management" feature envisioned DB-stored
editable templates. That adds a template engine + injection surface.
**Why:** DB templates = edit without deploy; file/react templates = type-safe, testable.
**How:** **recommendation: file-based first** (react-email), with DB-stored *content overrides*
(scoped by template + locale) as a later phase. Document the decision here so nobody rebuilds
it both ways.

## 23. i18n-ready templates (locale param from day one)

**What:** `render(props, { locale })` — the registry supports a `locale` at least structurally
(en strings today).
**Why:** auth-roadmap #26 built the i18n catalog on the FE; the email layer must not block
localization later.
**How:** `TemplateProps` carries an optional `locale`; the resolver picks the locale-scoped
template/strings; default `en` now, no behavior change.

## 24. `POST /emails/test` (SuperAdmin send test)

**What:** an endpoint that sends a chosen template with sample props to a given address (or the
caller's own).
**Why:** verifying Resend config + template output without triggering real flows.
**How:** `POST /admin/emails/test { template, to }` → renders with sample props → sends →
returns the result; write an `EmailLog` row like any send.

## 25. Send **outside** the request path (queue) for slow templates

**What:** currently `sendVerificationEmail` awaits Resend inline. For signup/login that adds
~200–500ms.
**Why:** request latency vs. email reliability — emails should not block the user's redirect.
**How:** fire-and-forget with the existing pattern (or a tiny `EmailQueueService` + cron
flusher, mirroring the logging doc's item 2). Keep ordering for resets (they matter);
verify-emails can be async.

## 26. Links are absolute + HTTPS, tokenized, no raw secrets

**What:** the current reset URL is `{appUrl}/auth/reset-password?token={rawToken}` — fine — but
all URLs must be absolute, use `APP_URL` (already done), and **not** log the token.
**Why:** a leaked reset link in logs = account takeover.
**How:** audit every URL built in templates; ensure tokens are only in the email, never in
logs/metadata; add `utm`/tracking only if analytics needs it.

## 27. `markdown` → HTML for future content emails (welcome, digest)

**What:** a shared `mdToEmailHtml` (remark) for long-form emails, so content authors write
markdown not HTML.
**Why:** welcome emails, digests, and breach alerts are content-heavy — markdown is
maintainable.
**How:** reuse the admin app's markdown pipeline if extractable, or add `marked`/`remark` to
`apps/api`; keep transactional emails as components (they need precise layout).

## 28. Template tests (render + snapshot + required-vars)

**What:** unit tests per template: renders without throwing, HTML contains the link/CTA,
plain-text contains the same variables, no raw `undefined` in output.
**Why:** a template regression ships a broken email to every user — tests are cheap insurance.
**How:** `EmailService`/registry tests in the API (needs the test setup from the logging doc's
item 30, or pure-render tests in `packages/shared` if templates live there).

## 29. Spam-score sanity (subject + preheader discipline)

**What:** no ALL-CAPS subjects, no "FREE!!", no misleading preheaders; keep a `preheader`
(visually hidden preview line) in every HTML email.
**Why:** spam filters + Gmail's category tabs; also improves open rates.
**How:** a `subject` + `preheader` prop in the template contract; a test asserting subject
length ≤ 78 and lowercase-ish.

## 30. `List-Unsubscribe` / one-click unsubscribe where relevant

**What:** for non-transactional sends (digests, breach alerts) include `List-Unsubscribe`.
**Why:** CAN-SPAM compliance and deliverability.
**How:** Resend supports headers — pass through the template's `headers`; transactional emails
exempt (they're service-required).

## 31. Error copy that helps the user (not "an error occurred")

**What:** template copy tells the user exactly what to do next ("click Reset", "expires in 1
hour", "if this wasn't you, contact support"). The current 3 templates mostly do — formalize
it.
**Why:** good transactional copy reduces support load.
**How:** a copy style guide in the doc; per-template review checklist.

## 32. Consistent branding (logo, colors, footer, legal line)

**What:** one shared `<Layout>` for all emails: logo, header band, footer with address +
unsubscribe + "you're receiving this because…".
**Why:** brand consistency builds trust; the footer legal line is a compliance must.
**How:** react-email `<EmailLayout>` component reused by every template; `APP_NAME` + address
from env.

## 33. New-email templates for the flows in the auth roadmap

**What:** the roadmap (items 6, 31, 33, 36) adds flows that need emails: **email change**
(verify new address), **new-device login** alert, **password changed** confirmation,
**2FA enabled** confirmation.
**Why:** security emails are the ones users trust most — and the flows can't ship without them.
**How:** add each as a template + registry entry + `EmailService` method; wire into the auth
service when those roadmap items land.

## 34. Time-sensitive copy (expiry shown to the user)

**What:** every tokenized email states the expiry in human terms ("expires in 24 hours").
Current templates do this — keep it as a rule for new ones.
**Why:** users act on urgency; and a user who knows the window won't report a "broken link"
that expired.
**How:** pass the expiry into template props (`expiresInHours`) rather than hardcoding copy
per template.

## 35. No raw user data in subjects (privacy)

**What:** subjects never include the user's email/full name beyond product-required context.
**Why:** the subject line is visible on shared screens/lock screens.
**How:** review the 3 current subjects (they're generic — good); keep new ones generic.

## 36. `EmailService` unit tests with a mocked Resend client

**What:** tests that stub `resend.emails.send` and assert payload shape (`from`, `to`, `html`
contains CTA, `text` non-empty).
**Why:** the send contract is the integration point — lock it down.
**How:** constructor-inject the Resend client (it's already a field — make it injectable for
tests), or mock the module.

## 37. Dev-mode mail sink (no real sends in dev/test)

**What:** when `NODE_ENV !== "production"` (or `EMAIL_DISABLED=true`), log the rendered email
instead of sending.
**Why:** a dev accidentally triggering 100 real verification emails to test addresses is a
real disaster; also avoids burning the Resend free quota.
**How:** `EmailService` checks the env; prints `[email:dry-run] to=... subject=...` via
`LogService` and returns `{ ok: true, id: "dry-run" }`.

## 38. `.env.example` + docs for all email vars

**What:** `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`,
`EMAIL_DISABLED`, `RESEND_WEBHOOK_SECRET`, `EMAIL_AUDIT_BCC` documented in `.env.example`.
**Why:** onboarding + deploys need the full list (rule 14 / getting-started doc).
**How:** extend `docs/getting-started.md`'s env table; cross-link this doc.

## 39. Health check includes Resend reachability

**What:** `GET /health` reports `email: ok | misconfigured` (key present, a light ping).
**Why:** a missing API key silently disables password resets — the worst failure to discover
late.
**How:** in the health endpoint, `EmailService.isConfigured()` (key non-empty) + optional
`POST /emails/test` from ops; never send a real email from health.

## 40. Document + runbook

**What:** this doc grows as items land: env vars, the template registry, how to add a new
email, the dry-run mode, and the Resend dashboard workflow.
**Why:** rule 14 — a junior must be able to add an email end-to-end.
**How:** each shipped item gets a ✅ and its recipe appended below; keep the "How to add a new
email" checklist at the bottom of this file.

---

## ✅ How to add a new email (checklist, once the system lands)

1. Add a `TemplateNameSchema` entry + a `templates/<name>.tsx` renderer (react-email) exporting
   `render(props) → { html, text }` with zod-validated props.
2. Register it in `TEMPLATE_REGISTRY`; add sample props for the preview page.
3. Add the `EmailService.send("<name>", props)` call at the trigger point (with `userId`/
   `correlationId` context).
4. Add an `EmailLog`-aware unit test (render + payload shape).
5. Preview it in `/admin/emails/preview`, send a dry-run, then a real test send.
6. Update this doc's registry table.

_Last updated: 2026-08-05._
