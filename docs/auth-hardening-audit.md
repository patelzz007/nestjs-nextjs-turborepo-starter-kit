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
| M6 | Medium | Auth state persisted in localStorage | In-memory Zustand; bootstrap from `/auth/me` | ✅ Fixed |
| M7 | Medium | Proxy cookie clear missing domain | `clearAuthCookies` helper with `COOKIE_DOMAIN` | ✅ Fixed |

## Verification evidence

- `@workspace/client` tests: 149/149 pass (auth, proxy-refresh, SSR refresh)
- API unit tests: `SessionsService`, `SessionRestrictionService`, `UserSessionRevocationService`
- Prisma migration: `20260908120000_auth_hardening` (`rotation_version`, `previous_token_hash`, `token_digest`)

## Residual risks

- Cross-tab refresh BroadcastChannel lock not yet implemented (mitigated by in-tab + SSR single-flight and atomic backend rotation).
- Legacy password-reset rows without `tokenDigest` require a new reset request (digest populated on create only).
- `SECURITY_HARDENING_ENABLED=1` enables Helmet/rate-limit outside production; set explicitly in staging.

## Operational notes

- Set `CORS_ORIGINS` to all first-party app origins (web/admin/merchant).
- Set `COOKIE_DOMAIN` consistently on API and Next proxies.
- Clients must send `X-Mutation-Intent: same-origin` on all cookie-authenticated mutations.
