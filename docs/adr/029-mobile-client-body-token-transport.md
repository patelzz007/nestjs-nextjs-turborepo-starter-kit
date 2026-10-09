---
title: "ADR 029: Mobile Is a Client Type With Body-Delivered Tokens"
tags: ["adr", "auth", "mobile", "sessions"]
description: "The Expo app authenticates as a fourth client type, `mobile`, that receives its access and refresh tokens in response bodies and sends them back as a Bearer header and a refresh body, instead of httpOnly cookies."
author: "Platform Team"
lastUpdated: 1791417600000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 29
---

# ADR 029: Mobile Is a Client Type With Body-Delivered Tokens

## Status

Accepted (2026-10-08). Implemented in piece 3 of the mobile plan (2026-10-08) — see [Mobile app §7](../technical/mobile/mobile-app.md#7-piece-3-the-mobile-client-type-in-the-api). The mobile app uses it since piece 5 (2026-10-09): Secure Store token provider, Bearer access token, body refresh, and sign-out / sign-out-everywhere through the api-client's `fetchBodyTokenLifecycleMutation` — see [§9](../technical/mobile/mobile-app.md#9-piece-5-appsmobile).

## Context

Every client today is a browser app (`web`, `admin`, `merchant`). Login, login verification and
`/refresh` deliver tokens only as httpOnly cookies, chosen per client type by `X-Client-Type`, and
`/refresh` reads the refresh token only from that cookie. The API already accepts
`Authorization: Bearer` access tokens.

A native app has no browser cookie jar. Cookie handling differs between iOS and Android networking
stacks, and `httpOnly` protects nothing on a device where no page script runs. The native app
instead has an OS-backed secret store (`expo-secure-store`: Keychain / Keystore).

## Decision

- Add `mobile` to the client types. A request declares it with the existing `X-Client-Type` header.
- For `mobile`, login, login verification, 2FA completion and `/refresh` return the access and
  refresh tokens **in the response body**; no auth cookies are set.
- For `mobile`, `/refresh` reads the refresh token from the request body, never a cookie.
- The app stores both tokens in `expo-secure-store` only (never AsyncStorage) and sends the access
  token as `Authorization: Bearer`.
- Everything else is unchanged and shared with browser clients: refresh-token rotation and reuse
  detection, per-device sessions, `logout` / `logout-all`, token-version revocation, audit logging
  (which records the client type).
- Browser client types never receive tokens in a body: the body transport is selected by client
  type on the server, not by a client-controlled flag.

## Alternatives

- **Cookie jar in the app** (reuse the cookie flow): fragile across platforms, and the httpOnly
  protection it imitates does not exist natively.
- **Body tokens for every client type**: weakens the browsers, where httpOnly cookies do keep
  tokens away from injected script.

## Consequences

- One server-side session model for all clients; only the transport differs.
- The shared response contracts gain a token-bearing variant used only for `mobile`.
- Mobile token safety rests on the OS secret store plus server-side rotation and reuse detection.
- A leaked mobile refresh token is usable until rotated or revoked, exactly like a leaked cookie;
  `logout-all` and token-version bumps revoke it.
