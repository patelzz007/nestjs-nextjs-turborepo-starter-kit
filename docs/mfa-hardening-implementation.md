---
title: "MFA Hardening — What We Built and How to Work With It"
tags: ["auth", "mfa", "security"]
description: "Plain-language guide to the MFA hardening work: what changed, where the code lives, and what to do when touching auth."
order: 5
author: "Acme Inc."
lastUpdated: 1788825600000
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# MFA Hardening — What We Built and How to Work With It

This document explains the **Harden Authentication and MFA** work in plain language. It is meant for junior developers who need to understand what changed, where the code lives, and what to do (or avoid) when touching auth.

For the original plan checklist, see `.cursor/plans/harden_authentication_mfa_1325bb7d.plan.md` (do not edit that file — it is the historical plan).

For deeper operational detail, also read:

- [`docs/auth-roadmap.md`](./auth-roadmap.md) — MFA Hardening section
- [`docs/token-refresh.md`](./token-refresh.md) — refresh + `tokenVersion` behavior

***

## What problem were we solving?

Before this work, authentication had gaps that are risky in production:

- Revoked refresh tokens could still be accepted in some cases.
- Access tokens were not always checked against the latest account security state.
- MFA secrets and challenges were not stored with production-grade safety.
- There was no clear path when a user lost their authenticator.
- Client apps did not consistently handle “you must finish MFA setup” states.

The goal was **mandatory TOTP MFA for every account**, with encrypted storage, safe recovery, and clear UX — without leaking whether an account exists.

***

## Conversation summary (what we discussed)

### 1. Core MFA hardening (the plan)

We implemented six areas from the plan:

| Area | What it means in simple terms |
|------|-------------------------------|
| **Critical auth fixes** | Reject bad refresh tokens, validate `tokenVersion` on every request, rate-limit auth endpoints, stop leaking signup/admin-login hints |
| **Secure MFA storage** | Encrypt TOTP secrets (AES-256-GCM), store login challenges in Postgres, add migrations + RLS |
| **MFA state machine** | Login MFA is a one-time challenge with attempt limits, TOTP replay protection, atomic backup codes |
| **Enrollment policy** | “Restricted” sessions until email + MFA are done; admin-reviewed recovery with a delay; step-up MFA for sensitive actions |
| **Client UX** | Login, security settings, and app proxies handle TOTP, backup codes, enrollment, and recovery |
| **Tests & docs** | Unit tests on API/client; updates to auth docs |

### 2. Follow-up fixes during implementation

These came up while building and testing:

- **Rotate 2FA UX** — separated “toggle 2FA” from “rotate keys” in security settings so buttons are not cramped.
- **Admin MFA recovery UI** — there is no “admin rotate user TOTP” button. Recovery is **support-reviewed**:
  - User requests recovery in security settings.
  - SuperAdmin approves/denies at `/settings/security/mfa-recovery`.
  - User detail page shows recovery status per user.
- **Stale shared package builds** — after changing Zod schemas in `packages/shared`, run `pnpm --filter @workspace/shared build` or client imports break.
- **Admin permissions catalog UI** — `/settings/access` Permissions tab uses a file-explorer tree (`TreeView`) instead of chips, with a detail panel when you click a permission.

***

## How authentication works now (simple flows)

### New user

```
Sign up → Verify email → Restricted session → Enroll TOTP (+ backup codes) → Full session
```

A **restricted session** can only reach safe endpoints (logout, profile, email verification, MFA setup, recovery). Proxies in `web`, `merchant`, and `admin` redirect restricted users to finish setup.

### Existing user (after enrollment deadline)

```
Login (password) → MFA challenge → TOTP or backup code → Full session
```

If MFA is required but not enrolled, they get a **restricted session** until enrollment is complete.

### User lost authenticator

```
User submits recovery request → Admin reviews → Approval + delay → MFA cleared → User re-enrolls
```

There is **no instant SuperAdmin “reset MFA”** that skips audit and delay. That is intentional.

### Role or permission change → forced logout

When an admin changes someone's role or direct permissions, that user is logged out on their **next API call** (not instantly in a background tab with no requests).

```
Admin changes role → server bumps tokenVersion + deletes refresh tokens
→ user's old JWT still in cookies → next request → 401 TOKEN_VERSION_MISMATCH
→ client clears cookies via /auth/logout → login page
```

Full diagram and code references: [`docs/token-refresh.md` — Session revocation after role or permission change](./token-refresh.md#session-revocation-after-role-or-permission-change).

### Sensitive admin actions (e.g. impersonation)

The user must have completed MFA **within the last few minutes** (step-up). Configured via `MFA_STEP_UP_TTL_MS` (default 5 minutes).

***

## What was implemented (by layer)

### API (`apps/api`)

| Piece | Role |
|-------|------|
| `SecretEncryptionService` | Encrypts/decrypts TOTP secrets (AES-256-GCM, versioned keys) |
| `MfaChallengeService` | Login MFA challenges: expiry, attempts, consume-on-success |
| `AccessTokenStateService` | Validates `tokenVersion`, `isActive`, `isDeleted` on each auth request |
| `RestrictedSessionGuard` | Blocks privileged routes when `sessionScope` is `restricted` |
| `MfaRecoveryService` | User recovery requests + admin approve/deny + scheduled unlock |
| `RedisThrottlerStorage` | Rate limits on auth endpoints (Redis, with in-memory fallback) |
| `sessions.service.ts` | Rejects revoked/deleted refresh tokens before hash check |
| Prisma models | Encrypted MFA fields, `TwoFactorLoginChallenge`, `mfa_recovery_requests`, etc. |
| `prisma/rls.sql` | Row-level security for new tables |

### Shared contracts (`packages/shared`)

- Token schemas include `sessionScope` (`full` | `restricted`).
- MFA recovery schemas in `schemas/auth/mfa-recovery.ts`.
- Login response types distinguish restricted enrollment vs full login.
- **Rule:** define data with Zod here first, then use inferred types — never duplicate types by hand.

### Client (`packages/client`)

| File | Role |
|------|------|
| `login-form.tsx` | TOTP step, backup codes, restricted enrollment handling |
| `security-settings-panel.tsx` | Enable/disable, rotate TOTP, copy/download backup codes |
| `mfa-recovery-request-panel.tsx` | User-initiated recovery |
| `restricted-session.ts` | Helpers to detect restricted session at runtime |

### Admin app (`apps/admin`)

| Location | Role |
|----------|------|
| `/settings/security/mfa-recovery` | Queue of recovery requests |
| `UserMfaRecoveryPanel` on user detail | Per-user recovery actions |
| `/settings/access` Permissions tab | Explorer tree + detail panel for permission catalog |
| `packages/ui/.../tree-view.tsx` | Reusable tree with optional checkboxes |

***

## Environment variables you must know

Set these in `apps/api/.env` (see `.env.example`):

| Variable | What it does | Typical default (dev) |
|----------|----------------|------------------------|
| `MFA_ENCRYPTION_KEYS` | JSON map of key version → base64 32-byte key | Dev-derived key if unset |
| `MFA_ENROLLMENT_DEADLINE_MS` | Grace period before MFA is mandatory | 30 days |
| `MFA_RECOVERY_DELAY_MS` | Wait after admin approval before MFA is cleared | 24 hours |
| `MFA_STEP_UP_TTL_MS` | How long “recent MFA” counts for privileged actions | 5 minutes |

**Production:** always set `MFA_ENCRYPTION_KEYS` explicitly. Do not rely on dev fallbacks.

***

## Dos and Don'ts

### Do

- **Rebuild shared after schema changes**
  ```bash
  pnpm --filter @workspace/shared build
  ```
  Then restart the dev server if client/API types look wrong.

- **Use Zod schemas in `packages/shared`** for any new auth request/response shape. Infer types with `z.output<typeof Schema>`.

- **Bump `tokenVersion`** when security-sensitive state changes (password, MFA, logout-all, role changes, recovery approval). Existing access tokens should stop working.

- **Treat MFA challenges as single-use.** Once verified or exhausted, the challenge row is consumed.

- **Show backup codes only once** at enrollment/rotation. Store hashed copies server-side.

- **Use restricted sessions** for “must finish email or MFA” — do not issue a full session and hope the UI blocks features.

- **Route restricted users in proxies** (`apps/web/proxy.ts`, `apps/merchant/proxy.ts`, `apps/admin/proxy.ts`) so they cannot browse the app until setup is done.

- **Run tests** after auth changes:
  ```bash
  pnpm --filter api test
  pnpm --filter @workspace/client test
  ```

### Don't

- **Don't store TOTP secrets in plaintext** in the database or logs.

- **Don't log backup codes, TOTP codes, or encryption keys** — not even in debug logs.

- **Don't bypass MFA** for “trusted devices” or similar. Device signals may affect risk, but they do not skip MFA.

- **Don't add an admin “force reset MFA”** that skips review and delay unless product/security explicitly redesigns the flow.

- **Don't return different error messages** that reveal whether an email exists on signup/login/admin-login paths.

- **Don't use `any`, `unknown`, or type casts** in new auth code (project rule). Use Zod + inferred types.

- **Don't edit the plan file** at `.cursor/plans/harden_authentication_mfa_1325bb7d.plan.md` — use this doc and `auth-roadmap.md` for living documentation.

- **Don't forget RLS** when adding Prisma tables that hold user-specific auth data. Update `schema.prisma`, migration, seed, `rls.sql`, and shared Zod.

***

## Common junior troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `AdminMfaRecoveryRequestSchema is not defined` in client | Stale `@workspace/shared` build | `pnpm --filter @workspace/shared build` |
| User stuck in redirect loop | Proxy + restricted session mismatch | Check `sessionScope` in token and proxy allowlist |
| `401 TOKEN_VERSION_MISMATCH` after password/MFA change | Expected — old tokens invalidated | User must log in again |
| MFA challenge always fails | Clock skew or replay | Check server time; ensure same code is not reused |
| Recovery approved but MFA still locked | Delay not elapsed | Wait for `MFA_RECOVERY_DELAY_MS`; check scheduled job |
| Permissions tab looks broken / old UI | Wrong component or cache | Use `AccessPermissionExplorerTree`; hard refresh |

***

## Security principles (remember these)

1. **Fail closed** — if token version, session, or challenge state is wrong, reject the request.
2. **One chance per challenge** — challenges are not reusable JWTs floating forever.
3. **Encrypt secrets at rest** — TOTP material never sits plaintext in Postgres.
4. **Recovery is slow and audited** — fast MFA bypass is a common attack path.
5. **Uniform public errors** — attackers should not learn which emails are registered.

***

## Quick file map (start here when debugging)

```
apps/api/src/modules/auth/
  services/
    mfa-challenge.service.ts      # Login MFA challenge lifecycle
    mfa-recovery.service.ts       # Recovery requests + admin review
    secret-encryption.service.ts  # TOTP encryption
    access-token-state.service.ts # tokenVersion + account state
    two-factor.service.ts         # TOTP enrollment / verify
  guards/
    restricted-session.guard.ts   # Blocks privileged APIs when restricted
    auth.guard.ts                 # Main auth + token state

packages/shared/src/schemas/auth/
  token.ts                        # sessionScope, step-up claims
  mfa-recovery.ts                 # Recovery API shapes
  two-factor.ts                   # 2FA setup/verify shapes

packages/client/src/lib/auth/
  login-form.tsx
  security-settings-panel.tsx
  restricted-session.ts
  mfa-recovery-request-panel.tsx

apps/admin/
  app/(panel)/settings/security/mfa-recovery/
  components/security/mfa-recovery-*.tsx
  components/access/access-permission-explorer-tree.tsx
```

***

## Related UI components (permissions catalog)

The permissions work is separate from MFA but was built in the same effort on the admin app:

- **`TreeView`** (`packages/ui/src/components/navigation/tree-view.tsx`) — explorer-style tree; optional `checkbox` on branches and leaves for future selectable grants.
- **`AccessPermissionExplorerTree`** — search, expand/collapse, tree + detail panel.
- **`AccessPermissionDetailPanel`** — shows permission key, metadata, related actions.

User-specific grant/revoke still happens on the **user profile** page via `AccessPermissionTree` (selectable mode with checkboxes).

***

## When you change something in this area

1. Update Zod in `packages/shared` if the API shape changes.
2. Run `pnpm --filter @workspace/shared build`.
3. Update API service + controller.
4. Update `packages/client` endpoints and UI.
5. Add or update tests.
6. Update `docs/auth-roadmap.md` or this file if behavior or env vars change.

***

*Last updated: September 2026 — covers MFA hardening plan implementation and follow-up admin/client work from the same delivery cycle.*
