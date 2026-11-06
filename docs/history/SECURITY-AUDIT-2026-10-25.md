# Security audit — 2026-10-25

Source-first, defensive audit of this NestJS + Next.js + Expo Turborepo monorepo.
Reviewed commit `a415e0ec` (worktree dirty: only untracked tool/skill dirs). Execution was
local and sandboxed only (macOS `sandbox-exec`, no external network, scratch-only writes); no
deployed endpoint, external service, or shared infrastructure was touched. This is one pass, not
a proof of absence — see *Coverage* at the end.

> This file contains exploit detail. It is a working note, like `SESSION-NOTES-*.md`; delete it
> when done and don't commit it.

---

## Posture summary

The security kernel is genuinely strong and the dominant pattern across the codebase is sound:
one global guard chain (`APP_GUARD_ORDER`), a single authorization kernel with no second path,
zod at every trust boundary, RLS with bypass-only kanban tables and ownership tables, constant-time
secret comparison, HMAC-verified GitHub and Resend webhooks over the raw body, capability-token file
transfers, CSRF mutation-intent checks, and careful token/session handling (transport pinned per
client type, revocation checks, restricted enrollment sessions). No SQL injection, no unsafe HTML
sink, no committed secret, no open redirect, and no SSRF was found in the paths reviewed.

Two real vulnerabilities were confirmed, both **medium**, and both the **same root-cause pattern**:
a security gate decides on the **raw `request.url`** (undecoded, fragment-bearing) while Fastify
routes on the **normalized, percent-decoded path** — so the gate and the router disagree about which
URL reaches a handler.

---

## Confirmed findings

| # | Severity | Title | Boundary | Observed result |
|---|----------|-------|----------|-----------------|
| 1 | Medium | Swagger docs gate bypassed by percent-encoding the path | Unauthenticated → SuperAdmin-only docs | `GET /v1/%64ocs-json` serves the OpenAPI document with the gate never firing |
| 2 | Medium | Restricted-session enrollment gate bypassed via a URL fragment | Restricted session → full-session routes | `GET /<route>#/merchant/me` reaches the privileged route while the guard allows it |

### Finding 1 — API docs gate keyed on the raw URL

- **Where:** `apps/api/src/platform/presentation/http/api-docs-access.gate.ts:22` (`isApiDocsRequest`) and `:46` (`onRequest`); registered at `apps/api/src/bootstrap/bootstrap-app.ts:149`; mount at `apps/api/src/platform/presentation/http/api-docs.ts:165`.
- **Principal:** an unauthenticated remote caller.
- **What the control is for:** in production with `SWAGGER_ENABLED=1`, the docs policy is `platform_admin`, meaning the Swagger UI and the `-json`/`-yaml` OpenAPI document must require a valid platform-SuperAdmin session.
- **The defect:** the gate is a Fastify `onRequest` hook that challenges a request only when `isApiDocsRequest(request.url)` is true, and that function does a literal prefix match (`path === prefix || startsWith`) on the **raw** request target. Fastify's router (find-my-way) percent-decodes the path before matching the docs routes. So an encoded path reaches the real route while the gate does not recognise it.
- **Reproduction (sandboxed, Fastify 5.12.7 / find-my-way 9.10.0):** with the gate logic replicated as the `onRequest` hook and `/v1/docs-json` registered —
  - `GET /v1/docs-json` → **401** (gated),
  - `GET /v1/%64ocs-json` → **200**, full document served, gate never fired,
  - `GET /v1/%64ocs` → **200** UI; `GET /%761/docs-json` → **200**.
  `@nestjs/swagger` 12.0.3 mounts the UI and documents as ordinary Fastify GET routes, so the real mount has the same mismatch.
- **Impact:** fully defeats the SuperAdmin-only control, disclosing the complete API surface (every route, parameter, schema) to an anonymous caller. It is specification disclosure, not direct data access — hence medium.
- **Fix (smallest effective):** decide access on the same path the router uses. In the gate, decode the portion before `?`/`#` with `decodeURIComponent` inside a `try/catch` and **fail closed** (treat a decode failure or ambiguity as a docs request), or run the check against `request.routeOptions.url` after routing. Add a regression test with `/v1/%64ocs-json` and `/v1/docs%2djson`. Defence in depth: `SWAGGER_ENABLED=0` in production.

### Finding 2 — Restricted-session gate keyed on the raw URL

- **Where:** `apps/api/src/platform/presentation/http/security/guards/restricted-session.guard.ts:91` (`isAllowlistedRoute`), `:94` (path from `request.url`, split only on `?`), `:98`–`:112` (the `path.includes("/files/")` and `path.endsWith(pathSuffix)` checks).
- **Principal:** a user holding a valid **restricted** session — authenticated with correct credentials but email not yet verified or MFA not yet enrolled.
- **What the control is for:** a restricted session may reach only an enrollment allowlist (logout, profile, email verification, MFA enrollment, a few named file/kyb routes); every other route must return `403 RESTRICTED_SESSION` until enrollment is finished.
- **The defect:** the allowlist is matched against the raw `request.url`. Fastify strips a `#` fragment before routing, but `request.url` keeps it, so a fragment whose text ends with an allowlisted suffix (`<route>#/merchant/me`) — or any target containing `#/files/` — satisfies `endsWith`/`includes`, while find-my-way dispatches the request to the base route.
- **Reproduction (sandboxed, real loopback socket, Fastify 5.12.7):** with the `endsWith('/merchant/me')` rule replicated as a `preHandler` and `/api/v1/auth/admin/users` registered —
  - `GET /api/v1/auth/admin/users` → **403 RESTRICTED_SESSION**,
  - `GET /api/v1/auth/admin/users#/merchant/me` → **200**, privileged handler ran (`req.url` retained the fragment; the router matched the base path).
  The `%23`-encoded form 404s, so the `#` must be sent literally — which a raw HTTP client (curl/socket) fully controls.
- **Impact:** defeats the mandatory email-verification / MFA-enrollment gate, letting a not-yet-enrolled user exercise their **full existing permissions** before completing enrollment. Route-level RBAC still applies, so this is a self-scoped control bypass, not cross-user access — hence medium.
- **Fix (smallest effective):** match the allowlist against the routed template, not the raw string. Use `request.routeOptions.url` (the audit layer at `audit-trail.service.ts:94` already does this), fall back to `403` when it is `undefined`, and compare templates exactly rather than `endsWith`/`includes`. Add regression tests sending `<route>#/merchant/me` and `<route>#/files/`.

### Shared remediation note

A small shared helper that returns the *routed, decoded* path (preferring `request.routeOptions.url`,
falling back to a decoded `request.url` with fail-closed behaviour) and using it in **both** gates would
fix the pattern once. A grep for other `request.url`-based decisions found only these two; the audit and
idempotency layers already use `request.routeOptions.url`, and the one remaining `request.url` reference in
`authorization.guard.ts:340` is an audit-log message string, not a control decision.

---

## Hardening notes (not confirmed vulnerabilities)

- **Clickjacking headers.** The Next.js apps (`apps/web`, `apps/admin`, `apps/merchant`) send no `X-Frame-Options` / CSP `frame-ancestors`; `rules/10-security-auth-authorization.md:291` calls for them. `SameSite=Lax` auth cookies blunt the session-riding risk, but a framing/UI-redress defence is still worth adding centrally (one response-header config per app). The API itself sets a strict CSP, HSTS, `nosniff` and `referrer-policy` via Helmet when `securityHardeningEnabled`.
- **Geo fuzzy search** uses `$queryRawUnsafe` (`prisma-geography.read-repository.ts:94`) but the table name comes from a closed internal union and all user input is passed as bound `$1`/`$2` parameters — not injectable as written. Worth a comment pinning that invariant so a future edit doesn't interpolate a value.
- **Docs search** (`apps/docs/src/scripts/search.ts`) uses `innerHTML` with `highlightTerms`; confirm `highlightTerms` HTML-escapes its input (the search index is build-time content, so blast radius is low, but it's the one `innerHTML` sink in app code).

## Positive patterns worth keeping

- One guard chain, one authorization kernel, uniform 403s that reveal no rule detail.
- Webhooks (GitHub, Resend) verify an HMAC over the exact raw body before parsing; constant-time secret compare.
- File access is capability-token based; uploads are checked by size, SHA-256 and magic bytes against a per-category MIME allowlist (no SVG/HTML types accepted for images).
- Tokens pin transport per client type; refresh-token-in-body is rejected for browsers; revocation and token-version checks on every protected route.
- The carry-github-link script writes ciphertext only, `0600`, never decrypts.

---

## Coverage

- **Profile:** standard, whole-monorepo, single pass. No prior audit ledger existed, so there is no carried coverage.
- **Reviewed:** API auth/authorization guard chain, all 60+ controllers and their route-level guards (full route×guard inventory built), identity/token/impersonation/session logic, files + storage transfer, kanban attachments, POS (API keys, pairing, redemptions), tenancy onboarding, RBAC mutations, GitHub integration (webhook, pictures, body-image parsing), email webhook, the three Next.js proxies + redirect allowlists, mobile token storage + deep-link handling, CI workflows, committed-secret scan, raw-SQL and HTML-sink sweeps.
- **Confirmed:** 2 (both medium). **Candidate/blocked/deferred:** 0.
- **Not exhaustively covered this pass:** deep per-field RLS policy proofs for every table, the analytics SQL builders beyond the injection check, the full web/mobile component trees, and dependency/supply-chain CVE triage. These are candidates for a follow-up scoped run.
- Full machine-readable records and the sandbox harnesses: `~/security-audit-skill/nestjs-nextjs-turborepo-starter-kit/run-1/`.
