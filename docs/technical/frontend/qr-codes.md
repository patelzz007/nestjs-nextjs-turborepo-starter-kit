---
title: "QR codes"
tags: ["qr-code", "ui", "mobile", "docs", "encoder", "2fa"]
description: "The in-house QR code generator: an ISO/IEC 18004 encoder in packages/shared with no third-party library, the web and native QrCode components, the API's 2FA SVG data URL, the merchant pairing QR, and qr fences in the docs."
order: 26
author: "Platform Team"
lastUpdated: 1792108800000
coverImage: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80"
---

# QR codes

Every QR code in the product is drawn by **one in-house encoder**,
[`packages/shared/src/lib/qr/`](../../../packages/shared/src/lib/qr/index.ts). The web kit, the native
kit, the API and this docs site all import it from `@workspace/shared`. No QR library is installed
anywhere in the monorepo ([ADR 054](../../adr/054-in-house-qr-encoder.md) explains why).

Generating a code is all this module does. **Scanning** happens only on the phone, through the
camera (`expo-camera`), in the mobile app's till mode (`apps/mobile/src/features/till`): see
[ADR 055](../../adr/055-mobile-qr-scanning-and-till.md) and
[the till](../mobile/mobile-app.md#1017-till-scan-and-redeem-rewards).

```qr title="Sample terminal pairing QR"
pos-pair:v1:ABCD2345
```

The code above is a `qr` fence in this page's markdown. The docs build draws it with the same
encoder (see [In the docs](#in-the-docs)).

## Where it is used

| Where | What it encodes | How it is drawn |
| --- | --- | --- |
| Web, customer claims (`apps/web/components/rewardhub/claims/qr-view.tsx`) | The claim's redemption payload | `QrCode` from `@workspace/ui` |
| Merchant, terminal pairing (`apps/merchant/components/terminals/pairing-code-dialog.tsx`) | `buildPosPairingQrPayload(code)` (`pos-pair:v1:<code>`) while the code is live | `QrCode` from `@workspace/ui` |
| Web and admin, Security settings 2FA setup (`packages/client/src/lib/auth/mfa/security-settings-panel.tsx`) | The `otpauth://` key URI | `QrCode` from `@workspace/ui` |
| Mobile, 2FA enrollment (`apps/mobile/src/features/two-factor/two-factor-enrollment.tsx`) | The `otpauth://` key URI, for a second device | `QrCode` from `@workspace/ui-native` |
| API, `POST /auth/2fa/setup` and `/rotate` (`two-factor.service.ts`) | The `otpauth://` key URI | `renderQrSvg` → `qrCodeDataUrl`, a `data:image/svg+xml;base64,…` URL |
| Admin and mobile component galleries | A demo value | `QrCode` (web / native) |
| This docs site | Whatever a `qr` fence holds | `remarkQrCode` at build time |

The web and mobile 2FA screens draw the code from `otpAuthUrl` rather than showing `qrCodeDataUrl`.
React Native's `Image` cannot display an SVG, and a vector code stays sharp at any pixel density.
The API still returns `qrCodeDataUrl`, so the response contract has not changed, and any client
with an `<img>` can show it.

## What the encoder implements

QR Code Model 2 as specified in ISO/IEC 18004:

- **Modes.** The whole text is written in the densest single mode that holds every character:
  numeric (`0-9`), then alphanumeric (`0-9 A-Z space $ % * + - . / :`), else byte. Byte mode
  writes UTF-8, encoded by hand from code points (`qr-utf8.ts`), so the encoder needs neither
  `TextEncoder` nor `Intl` (Hermes on React Native has only part of `Intl`). Kanji and ECI are not
  used. Every modern scanner reads UTF-8 byte mode.
- **Versions 1–40, levels L / M / Q / H.** The default level is `M`. The encoder picks the smallest
  version that fits. `minVersion` and `maxVersion` bound the search; set them to the same value to
  force a version. By default it then **boosts** the level as far as the text still fits in that
  same version, which adds damage tolerance at no cost in size (`boostErrorCorrection: false`
  turns this off).
- **Error correction.** Reed–Solomon over GF(256) with the primitive polynomial `0x11D`
  (`qr-galois-field.ts`, `qr-reed-solomon.ts`). Blocks are split and interleaved per the standard's
  tables (`qr-version-table.ts`, `qr-codewords.ts`).
- **Function patterns.** Finders with separators, timing patterns, alignment patterns, the dark
  module, the format information (BCH(15,5), masked with `0x5412`) and, from version 7, the version
  information (BCH(18,6)) (`qr-function-patterns.ts`, `qr-format-info.ts`).
- **Masking.** All 8 masks are scored with the 4 penalty rules, and the lowest score wins, the
  lower mask on a tie (`qr-mask.ts`). `mask` forces one mask, for tests and reproducible output.
- **Errors.** Text that does not fit throws `QrDataTooLongError` (bits needed vs. capacity).
  Out-of-range options throw `QrInvalidOptionsError`.

## API

```ts
import { encodeQr, qrMatrixToSvgPath, renderQrSvg, QrDataTooLongError } from "@workspace/shared";

// The symbol: version, level, mask and its modules.
const matrix = encodeQr("pos-pair:v1:ABCD2345", { errorCorrectionLevel: "M" });
matrix.size; // 25 (version 2)
matrix.isDark(0, 0); // true: the top-left finder. Anything outside the symbol reads as light.

// One compact SVG path: each horizontal run of dark modules is `M{x} {y}h{n}v1h-{n}z`.
const { path, viewBoxSize } = qrMatrixToSvgPath(matrix, { quietZoneModules: 4 });

// A standalone <svg> document: black on white, the 4-module quiet zone included. For the server.
const svg = renderQrSvg("otpauth://totp/…", { encode: { errorCorrectionLevel: "M" } });
```

| Export | Purpose |
| --- | --- |
| `encodeQr(text, options?)` | Encodes the text. Options: `errorCorrectionLevel`, `minVersion`, `maxVersion`, `mask`, `boostErrorCorrection`, validated by `QrEncodeOptionsSchema` |
| `QrMatrix` | `version`, `errorCorrectionLevel` (the level actually used), `mask`, `size`, `isDark(row, column)` |
| `qrMatrixToSvgPath(matrix, { quietZoneModules })` | `{ path, viewBoxSize }` for an inline `<svg viewBox="0 0 n n">` |
| `renderQrSvg(text, { encode, quietZoneModules, darkColor, lightColor })` | A complete `<svg>` string. Colours must be hex (`QrSvgColorSchema`), so no markup can be injected |
| `QrErrorCorrectionLevelSchema` | `z.enum(["L", "M", "Q", "H"])`, with the derived `QrErrorCorrectionLevel` type |
| `DEFAULT_QR_QUIET_ZONE_MODULES` | `4`, the margin the standard requires |
| `QrDataTooLongError`, `QrInvalidOptionsError` | The typed failures |

### The quiet zone

A scanner needs a light margin around the code. The standalone SVG and the docs figures include
the standard's 4 modules. `QrCode` on web and mobile draws **no** quiet zone inside its SVG,
because its framed tile (`bg-qr-background` plus padding) is the margin. This matches what the
components drew before.

### Colours

Codes are black on white in every theme, for maximum scanner contrast: the `qr-foreground` and
`qr-background` tokens (`packages/tokens/src/semantic.ts`).

- **Web:** the path fills with `currentColor` inside a `text-qr-foreground` / `bg-qr-background`
  frame.
- **Native:** `withUniwind(Svg)` maps `colorClassName="accent-qr-foreground"` onto the `Svg`'s
  `color`, and the path fills with `currentColor`.
- **Docs:** `global.css` defines `--qr-foreground` / `--qr-background` (deliberately not themed).

## In the docs

A fence with the language `qr` becomes a QR code figure. The build draws it as inline SVG, so the
page needs no script and no image file. The fence body is the text to encode, and `title="…"`
gives the code its accessible name:

````md
```qr title="Sample terminal pairing QR"
pos-pair:v1:ABCD2345
```
````

The plugin is `remarkQrCode` in `apps/docs/src/lib/markdown/qr-code.ts`.

## How correctness is verified

- **Unit tests** cover every step against values from the standard and published worked examples:
  GF(256) products, the degree-7 and degree-10 generator polynomials, the "HELLO WORLD" 1-M data
  and error-correction codewords, all 32 format strings, version strings (version 7 is `0x07C94`),
  alignment positions, capacities, the UTF-8 bytes (compared with `TextEncoder`), the four penalty
  rules and the SVG path.
- **Bit-for-bit reference matrices.** `qr-reference-matrices.json` was produced once by the `qrcode`
  npm package (v1.5.4) for 8 inputs: numeric, alphanumeric, UTF-8 with emoji and non-Latin text, a
  32-character claim token, an `otpauth://` URI (version 7), longer texts at versions 10 and 12,
  and a pairing payload. Together they cover every mask and every level. `qr-reference.test.ts`
  asserts that the in-house encoder reproduces each matrix exactly, and picks the same minimum
  version.
- **Automatic mask choice.** Penalty rules 1–3 score the same as `qrcode`'s. Rule 4 (dark-module
  balance) follows the standard, where 45–55 % dark scores 0. `qrcode` scores that rule
  off-centre: 50–55 % dark already costs 10 points. So the two encoders can pick different masks
  for the same data, and both results are valid and scannable. The test proves that rule 4 is the
  only difference: `qrcode`'s choice is exactly the mask that this encoder's rules 1–3 plus
  `qrcode`'s rule 4 select. A one-off comparison over 600 random inputs found the same version and
  bit-identical forced-mask matrices for all of them, and 7 different automatic masks. All 7
  disappeared with `qrcode`'s rule 4 swapped in.
