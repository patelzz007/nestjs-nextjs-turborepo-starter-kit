---
title: "ADR 054: An In-House QR Code Encoder in packages/shared"
tags: ["adr", "qr-code", "ui", "mobile", "dependencies"]
description: "Every QR code (web, merchant, admin, mobile, the API's 2FA data URL and the docs) is drawn by one ISO/IEC 18004 encoder in packages/shared. react-qr-code and qrcode are removed."
author: "Platform Team"
lastUpdated: 1792108800000
coverImage: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80"
order: 54
---

# ADR 054: An In-House QR Code Encoder in packages/shared

## Status

Accepted (2026-10-16).

## Context

QR codes came from three places:

- `react-qr-code` in `packages/ui` (web, merchant, admin).
- `react-qr-code` again in `packages/ui-native` (mobile).
- `qrcode` with `@types/qrcode` in `apps/api`, which rendered the 2FA enrollment PNG data URL.

The docs site could not draw a code at all. Each library had its own encoder, options and output
shape. None of them could run unchanged in the browser, Node, Hermes and an Astro build. The
codes the merchant console shows for the mobile till to scan also need a format all apps agree
on.

## Decision

- **One encoder,** in `packages/shared/src/lib/qr/`, exported from `@workspace/shared`. It is
  pure TypeScript with no DOM, Node or `Intl` API, and implements ISO/IEC 18004 Model 2:
  - numeric, alphanumeric and UTF-8 byte modes;
  - versions 1–40 and levels L/M/Q/H;
  - Reed–Solomon over GF(256), interleaving, every function pattern, all 8 masks and the 4
    penalty rules.

  It is split into small files, each with its own tests.
- **One drawing:** `qrMatrixToSvgPath` merges each horizontal run of dark modules into one path
  rectangle, and every renderer draws that path:
  - `QrCode` in `packages/ui`: an inline `<svg>`, `currentColor`;
  - `QrCode` in `packages/ui-native`: react-native-svg, `withUniwind(Svg)` for the token colour;
  - `renderQrSvg` on the API: a standalone SVG, base64-encoded into `qrCodeDataUrl`;
  - the docs: `qr` fences, drawn at build time.
- The 2FA screens on web and mobile draw the code from `otpAuthUrl`. `qrCodeDataUrl` stays in the
  response contract, so no client breaks.
- `react-qr-code`, `qrcode` and `@types/qrcode` are removed from every package.

## Alternatives considered

- **Keep the libraries.** Rejected. This would keep three encoders for one job, and a
  Node-only PNG path on the API. React Native's `Image` cannot show SVG, so the mobile 2FA screen
  would stay tied to the API's raster image. The docs would still have no option.
- **One third-party encoder everywhere** (`qrcode-generator`, Nayuki's library). Rejected. It is
  smaller than three libraries, but it is still an untyped or loosely typed dependency at the
  centre of a starter kit. It cannot be held to `rules/00`, and its output shape still needs an
  adapter per platform. The encoder is about 1,300 lines, comments included, of well-specified, fully tested code.
  It does not change once it conforms to the standard.

## Consequences

- One API (`encodeQr`, `qrMatrixToSvgPath`, `renderQrSvg`) and one set of typed errors
  (`QrDataTooLongError`, `QrInvalidOptionsError`) on every platform.
- Correctness is pinned by the standard's values in the unit tests, and by bit-for-bit
  reference matrices produced once by the `qrcode` package (`qr-reference-matrices.json`). The
  automatic mask can differ from `qrcode`'s, because that package scores penalty rule 4
  off-centre. Both choices are valid. See [QR codes](../technical/frontend/qr-codes.md).
- Kanji mode, ECI and mixed-mode segmentation are not implemented. Any text still encodes, through
  UTF-8 byte mode, at a slightly larger version than an optimal mixed segmentation would need.
- The 2FA data URL is now SVG, not PNG. Any external client that rasterised it must accept
  `image/svg+xml`.
