---
title: "Authentication Module Hardening — Security Audit"
tags: ["auth", "security", "audit"]
description: "Findings, remediations, and verification evidence from the authentication module hardening audit."
order: 4
author: "Acme Inc."
lastUpdated: 1790899200000
coverImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=630&fit=crop"
---

# Authentication Module Hardening — Security Audit

**Date:** 2026-09-08  
**Status:** Implemented

## Findings & remediation

| ID | Severity | Finding | Remediation | Status |
|----|----------|---------|-------------|--------|
| C1 | Critical | Refresh omitted `sessionScope` → restricted sessions escalated to `full` | `SessionRestrictionService` used at login + refresh; `generateSessionTokens` requires explicit scope | ✅ Fixed |
| H1 | High | `tokenVersion` bump did not invalidate in-memory access cache (~30s stale) | `UserSessionRevocationService` calls `AccessTokenStateService.invalidate()` | ✅ Fixed |
| H2 | High | Password reset O(N) bcrypt scan | Indexed `tokenDigest` SHA-256 lookup + migration | ✅ Fixed |
| H3 | Medium | Signup returned `user` for new emails only | Uniform message-only `SignupResponse` | ✅ Fixed |
| M1 | Medium | Concurrent refresh race (SSR/tabs/API) | Atomic CAS rotation, superseded error, SSR mutex, both-cookie validation | ✅ Fixed |
| M2 | Medium | CSRF relied on SameSite=Lax only | `MutationIntentGuard` + client/proxy/SSR headers | ✅ Fixed |
| M3 | Medium | Account lockout distinct error (`ACCOUNT_LOCKED`) | Unified `INVALID_CREDENTIALS` externally | ✅ Fixed |
| M4 | Medium | `@SuperAdminOnly` allowed `hasAdminAccess` | Guard requires `isSuperAdmin === true` | ✅ Fixed |
| M5 | Medium | Backup code verify consumed codes | `verifyBackupCode` uses non-consuming check | ✅ Fixed |
| M6 | Medium | Auth state persisted in localStorage | Per-mount `auth` feature store holding session status only (no token, no profile, never persisted); profile read from the `/auth/me` query; restored from `/auth/me` on every page load | ✅ Fixed |
| M7 | Medium | Proxy cookie clear missing domain | `clearAuthCookies` helper with `COOKIE_DOMAIN` | ✅ Fixed |

### Client session state (follow-up to M6, 2026-10-02)

The module-level `useAuthStore` singleton is gone. Client auth state is the `auth`
feature store (`packages/client/src/lib/features/auth`,
[ADR 023](./adr/023-client-state-feature-stores.md)), created once per `AuthProvider`
mount, so a server render never shares session state between requests.

- **State is status only:** `unknown`, `authenticated` (with the session scope), or
  `signed-out` (with the reason). The profile is server state in the `/auth/me`
  query, and `useAuth().user` is composed from both. Nothing is written to storage,
  and the Redux DevTools timeline (development builds only) carries no token.
- **Security behaviour is unchanged:** single-flight refresh, no refresh after the
  tab invalidated its session, cross-tab `logged-out` sent only after
  `POST /auth/logout` returns, restricted-scope handling, and the same redirects.
  These are covered by `features/auth/*.test.ts(x)`.
- **Weaknesses fixed in the same layer.** These were present before the
  migration. The guarantee now is that the cache is cleared on every way of
  losing the session and on every identity change:

  | Weakness | Fix |
  |---|---|
  | On a cross-tab `logged-out`, the receiving tab kept the previous member's data until its own logout POST returned. | The tab drops its state and cache first, then repeats the POST, then redirects. |
  | A different member signing in, in this tab or another, left the previous member's cached queries in place. A failed re-check dropped the session without clearing the cache. | The query-cache effect clears everything when the identity changes or the session is lost. Every sign-in also drops the cached `/auth/permissions`. |
  | A still-mounted component re-created the previous member's `/auth/me` or `/auth/permissions` from server `initialData` right after the clear. | Server-rendered session data seeds a query only while `useIsServerRenderedSession()` is true (session epoch 0). `/hello` also stamps it with the server's answer time. |
  | A late session-check answer could re-authenticate the tab after sign-out. | Checks that started in an earlier session epoch are dropped. |
  | Concurrent 401s ran the logout POST, broadcast and redirect once per request. | Only the call that ended the session runs the exit sequence. |
  | A failed session check treated every failure as "no session": a 5xx, 429, network error or timeout (an API blip, a deploy restart) signed the tab out of the UI and cleared its whole query cache. | ✅ Fixed (2026-10-02). The check classifies each answer (`valid` / `no-session` / `expired-access-token` / `unavailable`, `lib/auth/session/session-check.ts`). Only a 401 ends the session — after ONE single-flight refresh and a confirming read, or at once for a revoked session. Anything else is `[ Auth ] Session Check Failed`: status, epoch and cache are kept, and the check retries with capped, jittered backoff (6 retries, paused while hidden/offline, resumed on `online`, tab visible or "Try again"). A 10 s timeout ends hung checks. A shell notice (`SessionCheckNotice`) explains the state. |
  | A transient refresh failure in the 401 pipeline (5xx, network, or the 30 s cooldown) returned `false`, so `onUnauthorized` cleared the server session and redirected to login. | ✅ Fixed (2026-10-02). `OnRefresh` resolves a `RefreshResult`; `transient` fails only that request with `SessionRefreshUnavailableError`, and only `expired` ends the session. |
- **Removed duplicates:** the web reward-hub shell and the landing header each ran
  their own `/auth/me` → `login()` sync. That sync defaulted the session scope to
  `full` and broadcast `logged-in` to the other tabs on every page load. The
  `AuthSessionBootstrap` component is gone too; the provider now owns the session
  queries.

## Verification evidence

- `@workspace/client` tests: 149/149 pass (auth, proxy-refresh, SSR refresh)
- API unit tests: `SessionsService`, `SessionRestrictionService`, `UserSessionRevocationService`
- Prisma migration: `20260908120000_auth_hardening` (`rotation_version`, `previous_token_hash`, `token_digest`)

## Residual risks

- Cross-tab refresh BroadcastChannel lock not yet implemented (mitigated by in-tab + SSR single-flight and atomic backend rotation).
- `AuthGuard` (`apps/api/src/modules/auth/guards/auth.guard.ts`) turns ANY non-`Unauthorized` error during token validation — including a database outage in `AccessTokenStateService.assertTokenValid` — into `401 ACCESS_TOKEN_INVALID`. The browser now copes (the refresh it triggers fails as transient, so the session is kept), but the API should let infrastructure errors surface as 5xx/503. Follow-up.
- There is no client error-reporting pipeline; session-check contract violations are reported with a structured `console.warn` only.
- Legacy password-reset rows without `tokenDigest` require a new reset request (digest populated on create only).
- `SECURITY_HARDENING_ENABLED=1` enables Helmet/rate-limit outside production; set explicitly in staging.

## Operational notes

- Set `CORS_ORIGINS` to all first-party app origins (web/admin/merchant).
- Set `COOKIE_DOMAIN` consistently on API and Next proxies.
- Clients must send `X-Mutation-Intent: same-origin` on all cookie-authenticated mutations.
