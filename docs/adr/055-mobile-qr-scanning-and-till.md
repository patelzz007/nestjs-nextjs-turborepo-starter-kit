---
title: "ADR 055: QR Scanning on Mobile Only, Through expo-camera, for the Till"
tags: ["adr", "qr-code", "mobile", "rewards", "pos"]
description: "QR codes are scanned only in the mobile app: Google's code scanner on Android with Play services, the kit's own expo-camera scanner elsewhere. The scanner powers a till mode that pairs as a POS terminal and redeems customers' reward QR codes with the terminal's API key."
author: "Platform Team"
lastUpdated: 1792108800000
coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80"
order: 55
---

# ADR 055: QR Scanning on Mobile Only, Through expo-camera, for the Till

## Status

Accepted (2026-10-16).

## Context

Customers show a reward's QR code at checkout (`GET /claims/:claimId/qr`). Until now only a
third-party POS could read it, through `POST /redemptions/validate` and `/checkout` with a
terminal API key. The product wants the mobile app to scan those codes, with a scanner that feels
like Google's. Generating QR codes is already in-house everywhere (ADR 054). Scanning should not
pull in a third-party library either.

Constraints:

- The mobile app develops in **Expo Go** (rules/04), so it can use only native modules Expo Go
  ships. That rules out a custom native module and community scanners such as vision-camera or
  capacitor-mlkit.
- JavaScript has no access to camera frames without a native frame processor. Decoding QR codes in
  TypeScript on a live camera feed is therefore not possible here.
- A till is a machine principal (ADR 017): its calls must carry the terminal's API key, never the
  signed-in person's session.

## Decision

- **Scanning happens only in the mobile app**, through `QrScanner` (`@workspace/ui-native`), which
  is built on **expo-camera**. That is Expo's own module, and Expo Go includes it.
  - **An Android build with Google Play services** (not Expo Go): Google's code scanner opens
    (`CameraView.launchScanner`). This is ML Kit's full-screen scanner, the one Google ships, and
    it needs no camera permission.
  - **iOS, Expo Go, Android without Play services, or if Google's scanner fails to start:** the kit's own
    full-screen scanner opens. It shows `CameraView` (ML Kit on Android, AVFoundation on iOS)
    behind a dimmed frame with a bracketed viewfinder, a torch toggle and a close button.
  - VisionKit's iOS scanner is not used, because it has no close button and cannot be styled.
  - Google's scanner is not used inside Expo Go. Expo Go runs each project in its own Android task,
    and expo-camera starts the scanner from the application context, so Android opens it in a new
    task. Closing it lands on Expo Go's home instead of the app (found on a real Android device).
- **The till** (`/settings/till`, `src/features/till`):
  - **Pairing:** the merchant console's terminal pairing dialog shows a QR code of
    `pos-pair:v1:<code>` (`buildPosPairingQrPayload`). The till pairs with it
    (`POST /pos/terminals/pair`) and keeps the terminal's API key in Secure Store.
  - **Redeeming:** the till scans a customer's code, validates it and checks it out. Each checkout
    has one idempotency key per (code, bill).
- **The till's calls go through `createPosCaller`** (`@workspace/api-client`). They carry
  `X-API-Key` and `X-Terminal-Id` over an anonymous transport: no `Authorization` header, no
  cookies and no refresh. These routes are not part of `apiRouter`, so no hook can call them with
  a session.
- **Release builds request Google's scanner module at install.** The local config plugin
  `apps/mobile/config-plugins/google-code-scanner-module.ts` sets
  `com.google.mlkit.vision.DEPENDENCIES = barcode_ui`, so the first scan does not wait for Play to
  download the module.
- **Camera permission:** asked the moment the scanner opens, with a designed refusal state. The
  `expo-image-picker` plugin no longer blocks `android.permission.CAMERA`.

## Alternatives considered

- **A custom Expo module** in this repo (Kotlin on Google's code scanner, Swift on VisionKit).
  Rejected for now: it means leaving Expo Go for development builds, which the mobile plan defers
  (`mobile-app.md` §15.5). It remains the path if a product needs features expo-camera lacks.
- **A pure-TypeScript decoder** on camera frames. Not possible: there are no frames in JavaScript
  without a native frame-processor library.
- **Scanning on the web** (getUserMedia plus a decoder). Rejected: the product scope is
  mobile-only, and a web decoder would be either a third-party library or a large in-house one
  for a secondary surface.
- **Calling the POS routes through `apiRouter`.** Rejected: the token transport would attach the
  person's access token, and the API reads `Authorization: Bearer` as the API key first.

## Consequences

- One scanner component, which reports only the decoded text. The till decides what the text
  means (`classifyScannedCode`: a redemption token, a pairing code, or neither).
- The look differs on purpose: Android users see Google's own scanner, iPhone users see the kit's.
  Only the kit's scanner can be themed and translated (`labels`).
- A till stays paired after the person signs out, because it belongs to the merchant. Unpairing
  forgets the key on the device; revoking it is done in the merchant console.
