---
title: "ADR 080: Passkeys"
tags: ["adr", "security", "auth", "webauthn", "passkeys", "mobile"]
description: "Passkeys (WebAuthn) sign in to every app: as the second step of a password sign-in, or alone, passwordless. @simplewebauthn behind a port, discoverable credentials with user verification, single-use hashed challenges, a counter that only moves forward, the password again to add one, an email for every change, and the native apps linked through the web app's /.well-known/ files."
author: "Platform Team"
lastUpdated: 1793836800000
coverImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=630&fit=crop"
order: 80
---

# ADR 080: Passkeys

## Status

Accepted and built (2026-11-05), enhancement 1.7. The owner chose passkeys on the phone too, in the starter
kit's app only (a native module and a development build; the expo-boilerplate runs in Expo Go, which has no
passkey module, so it keeps password + TOTP: an accepted difference between the two repos).

## Context

Sign-in was a password, then a TOTP or backup code (ADR 041's MFA), then an emailed code on a new device.
TOTP codes can be phished: a fake page relays them in real time. A passkey is a key pair held by the
person's device (or synced by their password manager) and bound to this site's domain, so a phishing site
cannot ask for it, and the server holds only the public half.

## Decision

| Part | Decision |
|---|---|
| Library | `@simplewebauthn/server` 14 in the API, behind `WebAuthnPort` (`application/ports/web-authn.port.ts`); its types never leave `SimpleWebAuthnAdapter`. `@simplewebauthn/browser` 14 in `packages/client`; `react-native-passkey` 3.6 in the phone app. The browser's and the phone's answers are parsed with the shared schemas (`packages/shared/.../schemas/passkeys.ts`) before they are sent |
| Uses | (1) the second step of a password sign-in, instead of a TOTP or backup code, when the account has a passkey (`passkeyAvailable` in the two-factor answer); (2) a passwordless sign-in that names no account: the passkey does. Both end exactly as any sign-in: the admin and merchant gates, the new-device code, a forced enrollment |
| Credentials | Discoverable (resident key **required**) with user verification **required**, attestation `none`. At most 20 per account |
| Relying party | RP ID = `WEBAUTHN_RP_ID`, else `COOKIE_DOMAIN` without its dot, else `APP_URL`'s host. Every client app must be on it or under it (the API refuses to boot otherwise); the allowed origins are the three apps' origins plus `android:apk-key-hash:` for each Android signing certificate |
| Challenges | Single use, five minutes, stored as a SHA-256 digest (`WebAuthnChallenge`), tied to their purpose, their account and, for the second step, the password sign-in they finish. A maintenance job purges stale ones |
| Cloned authenticators | The signature counter only moves forward while either side counts; the repository writes it with a compare-and-set on the counter it read, so two concurrent uses cannot both pass. Synced passkeys report 0 and stay at 0 |
| Adding one | Needs the password again, then the device's prompt. Refused while impersonating. Every added or removed passkey is emailed to the account (`passkey-added`, `passkey-removed`) |
| Removing one | Soft delete by its owner (Security settings, web and phone). A completed MFA recovery removes every passkey of the account, attributed to the approving admin: recovery means the person lost their factors, and a passkey on a lost device must not sign in either |
| Failures | A verification failure is answered as one generic error (no detail for an attacker) and counts towards the account lockout like a wrong code; the reason is logged. Challenges and the signed parts of an answer are redacted from logs |
| Native apps | A phone offers a site's passkeys to an app only when the site says so. `GET /auth/passkeys/app-associations` (public) gives both files; the **web app** serves them at `/.well-known/assetlinks.json` (`WEBAUTHN_ANDROID_PACKAGE_NAME` + `WEBAUTHN_ANDROID_CERT_FINGERPRINTS`) and `/.well-known/apple-app-site-association` (`WEBAUTHN_APPLE_APP_IDS`), outside the web proxy, cacheable for an hour. The iOS build names the domain in its entitlements (`MOBILE_PASSKEY_DOMAIN`, `webcredentials:`) |

## Consequences

- **Local development:** passkeys work in a browser on `localhost` (WebAuthn allows it). On a phone they need a
  real HTTPS domain with the two files: Android and iOS refuse a ceremony for an RP ID that is not associated
  with the app, so a local API (localhost or a LAN address) answers "not set up", which the app says plainly.
- **Recovery and device loss:** losing the only passkey is the same as losing a TOTP device: the password plus
  a backup code, or an MFA recovery (ADR 041). A synced passkey (shown as "Synced") survives losing one device.
- **The phone app:** passkeys need a development or store build (the native module), never Expo Go. Renaming
  is on the web apps' security page; the phone lists, adds and removes.
- **Seed:** the MFA demo user has a synced passkey, a security key and a removed one, and a challenge of each
  purpose; their keys are random bytes, so no seeded passkey can sign in.
