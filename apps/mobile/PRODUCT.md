# Product — Mobile app

<!-- impeccable:product-schema 1 -->

Inherits the root `PRODUCT.md`; only what differs is recorded here.

## Platform

web

Expo (iOS + Android) with **one shared design language** on both operating systems, not per-OS
conventions (confirmed 2026-10-27). Since 2026-11-05 that language is the app's own, not the web
apps' brand: a generic, neutral account app any product can rebrand (ADR 079). The value is recorded as
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

- The bottom floating tab bar keeps its shape and motion; its colours are its own tokens (`tab-bar*`),
  as shipped in light, matching the surfaces in dark and Nord. The active tab is a solid capsule, inset.
- Generic over themed (owner, 2026-11-05): the category standard at Linear / Things precision and
  Airbnb / Notion roominess; neutral ink accent (Frost in Nord); Geist for text, Bricolage Grotesque for button labels only.
- Dark mode is graphite (owner's pick, 2026-11-05, "neutral, a touch cool"): #1c1d20 page, #292b2f cards,
  #313337 raised, #3a3c40 borders, #f0f1f4 text, #a9adb6 secondary text, #8ab4ff links. Light mode uses slate (slate-900 text, slate-800 fills), never black.
- The page header shows no ping or session pills; they live in the drawer, tinted.
