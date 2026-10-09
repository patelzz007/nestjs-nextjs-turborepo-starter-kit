---
title: "ADR 034: Immediate Per-Session Revocation"
tags: ["adr", "auth", "sessions", "jwt"]
description: "Access tokens carry the id of the session that issued them, and the per-request token-state check rejects revoked sessions, so signing out one device takes effect on that device's next request."
author: "Platform Team"
lastUpdated: 1791504000000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 34
---

# ADR 034: Immediate Per-Session Revocation

## Status

Accepted (2026-10-08). Implemented (2026-10-09) — see
[mobile app plan §8.10](../technical/mobile/mobile-app.md#810-what-the-implementation-changed).
Extends [ADR 003](./003-jwt-identity-only.md).

## Context

Users get a list of their device sessions (every client type, web and mobile) and can sign out any
one of them. "Sign out everywhere" is already immediate: it revokes every refresh token and bumps
the user's token version, which the per-request access-token state check enforces on every API
instance. Revoking a single refresh token, by contrast, only stops that device from refreshing; its
current access token keeps working until it expires (up to 15 minutes). For a lost or stolen
device, that window is the wrong answer.

## Decision

- Access tokens carry `sid`: the id of the device session (refresh-token row) that issued them.
  A session id is identity, not authorization data, so ADR 003 still holds.
- `POST /auth/sessions/:sessionId/revoke` soft-deletes one of the caller's own sessions (others'
  return 404), records `deletedBy`, writes an audit entry, and invalidates that session in the
  access-token state cache on every API instance after commit.
- The per-request access-token state check rejects a token whose `sid` is revoked, the same way it
  rejects a stale token version.
- Revoking the caller's current session behaves like a normal sign-out.

## Alternatives

- **Wait for access-token expiry**: leaves a lost device usable for up to 15 minutes.
- **Bump the token version**: signs out every device, not one.

## Consequences

- One more check per authenticated request, served from the same cache as the token-version check.
- Tokens issued before `sid` existed lack it; they expire within one access-token lifetime and are
  then replaced.
- Session revocation reasons (`deletedBy`: the user, or a system marker for rotation reuse,
  `logout-all` and expiry cleanup) become queryable.

## Implementation notes

- **Where `sid` comes from.** The refresh-token row is rotated in place, so its id is stable for
  the life of the device session: it is the refresh token's `jti` and the access token's `sid`
  (`TokenService.generateSessionTokens`). The session id is chosen before the tokens are signed, so
  the row is written once, complete (`AuthSessionService`).
- **The check.** `AccessTokenStateService` caches, per user, the ids of sessions revoked within one
  access-token lifetime (plus a one-minute skew margin) next to `tokenVersion`; they are loaded in
  the same query on a cache miss. A token whose `sid` is among them answers `401 SESSION_REVOKED`,
  a dead-session code the clients do not try to refresh.
- **Invalidation.** Logout, revoke-one and the session cap's retirement drop the user's cached state
  after commit on every instance (`AuthorizationInvalidationService`, trigger `session_revoked`);
  the all-session revocations already did (token-version bump).
- **Race with refresh.** Revoke and rotation are conditional updates of the same row
  (`isDeleted = false`; the revoke also moves `rotationVersion`), so the second to commit sees the
  first: a losing refresh answers 401, a losing revoke still revokes the rotated row.
- **Impersonation.** An impersonation session may list the user's devices but not revoke one
  (`403 SESSION_REVOKE_DURING_IMPERSONATION`): the revocation would be recorded as the user's own.

