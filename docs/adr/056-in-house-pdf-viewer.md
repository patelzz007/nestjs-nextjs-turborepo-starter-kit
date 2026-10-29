---
title: "ADR 056: An In-House PDF Viewer on Each Platform's Own PDF Engine"
tags: ["adr", "pdf", "ui", "mobile", "docs", "dependencies"]
description: "PDFs are shown by the kit's own viewer around the PDF engine each platform ships (the browser, PDFKit, PdfRenderer). No PDF library is installed; the mobile engine is a local Expo module with an Expo Go fallback."
author: "Platform Team"
lastUpdated: 1793232000000
coverImage: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1600&q=80"
order: 56
---

# ADR 056: An In-House PDF Viewer on Each Platform's Own PDF Engine

## Status

Accepted (2026-10-17). Amended 2026-10-29: the module's native sources are now in the repository
(see [the amendment](#amendment-2026-10-29--the-native-sources-are-committed)).

## Context

PDFs appear in the web apps (KYB documents in admin and merchant), will appear in products built
on the starter, and need a viewer in the mobile app and the docs site. Until now the KYB preview
was a bare `<iframe>`: no loading or failure state, a blank frame on Android Chrome (which
downloads PDFs instead of showing them), and nothing on mobile or in the docs.

The usual answer is a PDF library: pdf.js / react-pdf on the web, react-native-pdf or
react-native-pdf-renderer on mobile. The product owner asked for **no third-party PDF library**.
Writing our own PDF renderer (parser, compression, embedded fonts, images, encryption) would be a
multi-week effort that still draws many real-world PDFs wrongly.

Every platform we target already ships a mature PDF engine: every desktop browser and iOS Safari
(built-in viewer), iOS (PDFKit) and Android (`android.graphics.pdf.PdfRenderer`, API 21+).

## Decision

1. **Pages are drawn by the platform's engine; the kit owns everything around it.** One viewer per
   platform — `PdfViewer` in `@workspace/ui` (web), `PdfViewer` in `@workspace/ui-native`
   (mobile), the ```` ```pdf ```` fence in the docs — with the kit's toolbar, file checks and
   loading / empty / failure / unsupported states.
2. **Shared rules in `@workspace/shared`** (`packages/shared/src/lib/pdf`): `checkPdfFile`
   (size limit, `%PDF-` header), the closed `PdfOpenFailure` list every viewer words, `pdfFileName`,
   and `buildTextPdf` for demos and tests (no binary fixtures committed).
3. **Web: a frame, not a fetch.** A signed URL from the API is loaded by the browser's engine in an
   `<iframe>` (no referrer); a picked file is checked locally and shown from a `blob:` URL. Where
   `navigator.pdfViewerEnabled` is `false`, the viewer offers open-in-new-tab and download instead
   of a blank frame.
4. **Mobile: a local Expo module** (`apps/mobile/modules/pdf-renderer`, Swift on PDFKit, Kotlin on
   `PdfRenderer`) renders pages to images the native kit's virtualised list shows. It is loaded
   with `requireOptionalNativeModule`; in **Expo Go**, which cannot load custom native code, the
   viewer hands the file to the system's PDF viewer through `expo-sharing` instead. Files are picked
   with `expo-document-picker`. Both are first-party Expo SDK modules that Expo Go ships.
   The module is stateless (`openDocument`, `renderPage` → a cached PNG per file, page and width);
   renders are capped at 2048 px wide, zoom runs 100–300 % (never below fit-width), and the 50 MiB
   limit is checked once a remote file has downloaded.
5. **rules/04 is amended**: the mobile app may contain local Expo modules under
   `apps/mobile/modules/` **only** when the feature keeps working in Expo Go through an explicit
   fallback, and the module stays a thin wrapper over a platform API (no third-party native code).

## Consequences

- No PDF library in any `package.json`; nothing extra in the web bundles (the docs embed ships no
  React at all).
- The web toolbar cannot drive the browser's viewer: page navigation, zoom, search and print come
  from the browser's own UI inside the frame, and look different per browser.
- Android Chrome cannot show PDFs inline; web users there get open/download, by design.
- In Expo Go, mobile users get the system viewer, not in-app pages. In-app pages need a development
  or store build (`npx expo run:android|ios`, or EAS when the product adopts it). The Kotlin and
  Swift code cannot be unit-tested in Jest: it is kept thin, and its JS contract is tested through a
  fake module.
- A product that later needs annotations, text selection across platforms or identical rendering
  everywhere should revisit this ADR rather than grow the viewer into a PDF engine.

## Alternatives considered

- **pdf.js / react-pdf (web), react-native-pdf (mobile).** Rejected by the product owner (no
  third-party PDF libraries); also ~1 MB of worker code on the web.
- **Our own PDF renderer in TypeScript.** Rejected: weeks of work and still wrong for common PDFs
  (CFF/Type 1 fonts, JBIG2 scans, encryption, shadings).
- **Expo Go only (iOS WKWebView via react-native-webview, Android system viewer).** Rejected: no
  in-app viewing on Android at all, and no control over the iOS UI.
- **Fetching signed URLs into `blob:` URLs on the web** (to check the header before showing).
  Rejected: it needs a CORS rule on the storage bucket for reads; the API already validated the
  file type at upload.

## Amendment (2026-10-29) — the native sources are committed

**What was wrong.** The module has four hand-written native files:

| File | What it is |
| --- | --- |
| `modules/pdf-renderer/ios/PdfRendererModule.swift` | The iOS module, on PDFKit |
| `modules/pdf-renderer/ios/PdfRenderer.podspec` | Declares the iOS module to CocoaPods |
| `modules/pdf-renderer/android/build.gradle` | Declares the Android module to Gradle |
| `modules/pdf-renderer/android/src/main/java/expo/modules/pdfrenderer/PdfRendererModule.kt` | The Android module, on `PdfRenderer` |

They were written with this ADR on 2026-10-17, and the Android one was compiled locally that day.
None of them was ever committed: `apps/mobile/.gitignore` ignored the generated native projects with
the bare patterns `ios/` and `android/`. Git applies a bare pattern at every depth, so it also hid
these two folders. The repository held only `modules/pdf-renderer/expo-module.config.json`. A fresh
clone's development or store build would therefore have had no PDF engine, and in-app pages would not
appear. Expo Go was unaffected, because it always uses the system-viewer fallback.

**The fix.** The patterns are anchored to the app's root (`/ios/`, `/android/`), so they ignore only
the projects `npx expo prebuild` generates. Gradle's output inside a local module
(`modules/*/android/build/`, `modules/*/android/.gradle/`) is ignored explicitly instead. The four
files above now show as new and go in with the next commit. Their content is unchanged.

**For the future.** A local Expo module's `ios/` and `android/` folders are source and are committed.
Check `git ls-files apps/mobile/modules/<name>` after adding one. The same class of bug, an unanchored
ignore rule hiding source, was found and fixed for the operations backup commands in commit
`0f2c2f43`.
