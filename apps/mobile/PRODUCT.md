# Product — Mobile app

<!-- impeccable:product-schema 1 -->

Inherits the root `PRODUCT.md`; only what differs is recorded here.

## Platform

web

Expo (iOS + Android) with **one shared design language** on both operating systems, matching
the web apps' brand, not per-OS conventions (confirmed 2026-10-27). The value is recorded as
`web` because that is what this product record means by one shared language, not because the
app runs in a browser.

## Users

The same people as the root record, signed in on their phones. Today the app is a generic
starter shell rather than a RewardHub surface.

## Product Purpose

A complete mobile foundation to build on:

- sign-in with every step the API can ask for (password, authenticator or backup code,
  emailed new-device code);
- forced 2FA enrollment, sign-up and password reset;
- Home, Analytics (sample data, no API call yet), a Search placeholder and Profile;
- Settings: appearance, security, signed-in devices, app lock, about and sign out;
- the blocking update and configuration-error screens.

## Capabilities and Constraints

- **Client type `mobile`:** tokens travel in JSON bodies and are kept in the OS secret store.
- **Tests:** Jest via jest-expo, the one exception to the repo's Vitest standard (ADR 031).
- **Placeholders:** Analytics sample data and Search are placeholders and must be labelled as
  such until they are wired to the API.

## Brand Commitments

The active tab is a solid primary capsule, inset.
