---
title: "PDF viewer"
tags: ["pdf", "ui", "mobile", "docs", "files"]
description: "The in-house PDF viewer: the kit's own toolbar and states around each platform's built-in PDF engine (the browser on web, PDFKit on iOS, PdfRenderer on Android), with no PDF library, in the web apps, the mobile app and the docs."
order: 27
author: "Platform Team"
lastUpdated: 1792195200000
coverImage: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1600&q=80"
---

# PDF viewer

Every PDF the product shows goes through **one viewer per platform**, and none of them bundles
a PDF library (no pdf.js, no react-pdf, no react-native-pdf). The pages are drawn by the PDF
engine the platform already ships; the kit owns everything around it: the toolbar, the file
checks, and the loading, empty, failure and "can't show it here" states.
[ADR 056](../../adr/056-in-house-pdf-viewer.md) records why.

| Platform | Component | Pages drawn by |
| --- | --- | --- |
| Web, merchant, admin (Next.js) | `PdfViewer` from `@workspace/ui/components/pdf-viewer` | The browser's built-in PDF viewer, in a frame |
| Docs site (Astro) | ```` ```pdf ```` fence (`apps/docs/src/lib/markdown/pdf-embed.ts`) | The browser's built-in PDF viewer, in a frame |
| Mobile (Expo) | `PdfViewer` from `@workspace/ui-native/components/pdf-viewer` | PDFKit (iOS) / `PdfRenderer` (Android) through the local module `apps/mobile/modules/pdf-renderer` — see [Mobile](#mobile) |

```pdf title="PDF viewer sample.pdf"
/files/pdf-viewer-sample.pdf
```

The PDF above is a `pdf` fence in this page's markdown (see [In the docs](#in-the-docs)).

## Shared rules (`@workspace/shared`)

[`packages/shared/src/lib/pdf/`](../../../packages/shared/src/lib/pdf/index.ts) holds what every
viewer agrees on. It is pure TypeScript, so the web kit, the native kit and the docs all import it.

| Export | What it is |
| --- | --- |
| `checkPdfFile({ sizeBytes, leadingBytes }, maxBytes?)` | The check a viewer runs before it hands a file to the engine: not empty, at most `MAX_PDF_VIEWER_FILE_BYTES` (50 MiB), and a `%PDF-` header within the first KiB (`PDF_HEADER_SEARCH_WINDOW_BYTES`, the window real readers accept) |
| `PdfOpenFailureSchema` / `PdfOpenFailure` | The one closed list of reasons a PDF is not shown: `empty`, `too_large`, `not_a_pdf`, `password_protected`, `unreadable`, `unavailable`. Each kit words every reason (a `Record`, so a new reason fails to compile until it has copy) |
| `pdfFileName(name)` | The name a PDF is downloaded or shared as: the last path segment, without characters file systems reject, ending in `.pdf` (`document.pdf` when nothing is left) |
| `PDF_MEDIA_TYPE`, `PDF_FILE_EXTENSION` | `application/pdf` and `.pdf` — never written as literals elsewhere |
| `buildTextPdf(pages)` | Writes a small valid PDF of text pages, for demos and tests (the admin gallery's sample, this page's sample, test fixtures). Not a document generator |

The engine still has the last word: a file can pass `checkPdfFile` and be damaged further in. The
web engine shows its own message then; the native engine rejects it as `unreadable`.

## Web (`@workspace/ui`)

```tsx
import { PdfViewer, type PdfViewerSource } from "@workspace/ui/components/pdf-viewer";

// A signed object-storage URL from the API (served `inline`), with its `attachment` twin for download:
<PdfViewer source={{ kind: "url", url: viewUrl, downloadUrl, fileName }} className="h-[70vh]" />;

// Or let the person open a PDF from their device — controlled, like an input's `value`:
const [source, setSource] = React.useState<PdfViewerSource | null>(null);
<PdfViewer source={source} onSourceChange={setSource} className="h-[70vh]" />;
```

- **Sources.** `{ kind: "url" }` is a URL **the app's own API signed** (`downloadOrganizationDocument`
  and friends). The page never fetches it: the browser's engine loads it in a frame, so the storage
  bucket needs no CORS rule for reads. `{ kind: "file" }` is a picked `File`; `usePdfDocument`
  reads its first KiB, runs `checkPdfFile`, and shows it from a `blob:` URL that is revoked when the
  file changes or the viewer unmounts. Nothing is uploaded.
- **Toolbar.** The file's name, then open-from-device (only when `onSourceChange` is passed), open
  in a new tab, download (`pdfFileName`) and fullscreen (`useFullscreen`, hidden where the page
  cannot go fullscreen, e.g. iPhone Safari). Page navigation, zoom, search and print come from
  the browser's own viewer inside the frame.
- **States.** Empty (`source={null}`), checking a picked file (a page-shaped skeleton in a
  `SkeletonRegion`), failed (`role="alert"`, the reason from `labels.failures`, and "Open a PDF"
  again), ready. While a ready frame paints its first page, a skeleton sits behind it, so there is
  no blank flash and nothing to get stuck if the browser never fires `load`.
- **Browsers that cannot show PDFs inline.** `navigator.pdfViewerEnabled` is `false` on Android
  Chrome (and wherever the person turned the built-in viewer off): the browser would download the
  file instead of showing it. The viewer then shows "This browser can't show PDFs here" with
  open-in-new-tab and download buttons, never a blank frame (`readPdfInlineSupport`,
  `@workspace/ui/lib/media/pdf-inline-support`).
- **Copy.** The `pdfViewer` family of `UiKitLabels` (`packages/ui/src/lib/labels/en.ts`); override
  per usage with `labels`.
- **Sizing.** The viewer fills its parent's height (minimum `min-h-96`); give it a height
  (`className="h-[70vh]"`).

### Where it is used

| Where | Source |
| --- | --- |
| Admin, merchant verification review (`apps/admin/app/(panel)/merchants/verification/kyb-review-panel.tsx`) | The KYB document's signed `inline` and `attachment` URLs |
| Merchant, verification settings (`packages/client/src/lib/merchant/kyb/verification-view.tsx`) | The same, for the merchant's own documents |
| Admin component gallery (`/components/pdf-viewer`) | An in-memory sample (`buildTextPdf`), plus any PDF picked from the device |

Both KYB previews go through `MerchantKybDocumentPreviewDialog`
(`packages/client/src/lib/merchant/kyb/document-preview-dialog.tsx`): a PDF opens in `PdfViewer`,
an image keeps the `<img>` preview with the dialog's own view-source and download buttons.

### Security

- Only URLs the API signed reach a `url` source. Never build one from a query string or user input:
  the frame would show whatever that URL serves under the app's origin.
- The frame sends no referrer (`referrerPolicy="no-referrer"`), so a signed URL never leaks to a
  page the PDF links to. New-tab links use `rel="noopener noreferrer"`.
- The frame is not sandboxed on purpose: Chrome's and Firefox's PDF viewers refuse to run in a
  sandboxed frame. What it shows is a PDF from our storage or the person's own file.

## In the docs

A `pdf` fence embeds a PDF. Its body is the URL — a path on the docs site or an `https://` URL
(anything else fails the build) — and `title="…"` is the file name shown:

````md
```pdf title="PDF viewer sample.pdf"
/files/pdf-viewer-sample.pdf
```
````

`remarkPdfEmbed` turns it into static HTML at build time: a header with the name, open-in-new-tab
and download, above a frame. No React and no PDF library ship to the page. Where the browser cannot
show PDFs inline, `src/scripts/pdf-embeds.ts` removes the frame and shows a note pointing at the
two links (the same `readPdfInlineSupport` the web kit uses). `/files/pdf-viewer-sample.pdf` is
written at build time by `buildTextPdf` (`apps/docs/src/lib/pdf-sample.ts`), so no binary file is
committed.

## Mobile

The native kit's `PdfViewer` (`packages/ui-native/src/components/pdf-viewer.tsx`) is
presentational: the app injects the engine and the copy. `apps/mobile/src/features/pdf-viewer`
wires it to the local Expo module `apps/mobile/modules/pdf-renderer` and owns the screen
`/settings/pdf-viewer` (Settings → PDF viewer, and the drawer's **Documents** group). The full
description is [the mobile app guide, §10.18](../mobile/mobile-app.md#1018-pdf-viewer); in short:

- **Engine.** Swift over PDFKit, Kotlin over `PdfRenderer`, both stateless:
  `openDocument(fileUri) → { pageCount, pages: [{ width, height }] }` and
  `renderPage(fileUri, pageIndex, widthPx) → file://…png` (cached per file, page and width).
  Rejections (`ERR_PDF_PASSWORD_PROTECTED`, `ERR_PDF_UNREADABLE`, …) map onto `PdfOpenFailure`;
  every answer is parsed with zod.
- **Sources.** A picked file (`expo-document-picker`), the sample (`buildTextPdf`), or a URL another
  screen pushes with `router.push(pdfViewerHref(url, name))` (downloaded with `expo-file-system`).
  Every file passes `checkPdfFile` before the engine sees it.
- **Viewer.** A virtualised column of pages rendered as they scroll into view, a page indicator,
  previous / next, zoom (100–300 %, never below fit-width), and "Open in another app"
  (`expo-sharing`). Renders are capped at 2048 px wide to bound memory.
- **Expo Go.** The module cannot load there (`requireOptionalNativeModule` returns `null`), so the
  viewer shows "Open this document in another app" and hands the checked file to the system's PDF
  viewer. In-app pages need a development build: `npx expo run:android` / `npx expo run:ios` from
  `apps/mobile`.

## Testing

| What | Where |
| --- | --- |
| File checks, file names, the sample writer (xref offsets, stream lengths, escaping) | `packages/shared/src/lib/pdf/__tests__/*.test.ts` |
| `usePdfDocument` (URL, picked file, rejected files, blob URL revoked on change and unmount) | `packages/ui/src/hooks/__tests__/use-pdf-document.test.tsx` |
| `useFullscreen`, inline support | `packages/ui/src/hooks/__tests__/use-fullscreen.test.tsx`, `packages/ui/src/lib/media/__tests__/pdf-inline-support.test.tsx` |
| `PdfViewer` (toolbar, states, file picker, unsupported browsers, fullscreen, label overrides) | `packages/ui/src/components/__tests__/pdf-viewer.test.tsx` |
| KYB preview dialog (PDF vs image) | `packages/client/src/lib/merchant/kyb/__tests__/document-preview-dialog.test.tsx` |
| Admin gallery demo | `apps/admin/components/component-gallery/__tests__/family-demos.test.tsx` |
| Native kit viewer and its layout maths | `packages/ui-native/src/components/__tests__/pdf-viewer.test.tsx`, `packages/ui-native/src/lib/__tests__/pdf-viewer-layout.test.ts` |
| Mobile engine mapping, sources, files, screen, gallery (with fake native, picker, sharing and file-system modules) | `apps/mobile/src/features/pdf-viewer/__tests__/`, `apps/mobile/src/__tests__/app/(app)/settings/pdf-viewer.test.tsx` |
| Docs fence, sample, unsupported-browser script | `apps/docs/src/lib/markdown/__tests__/pdf-embed.test.ts`, `apps/docs/src/lib/__tests__/pdf-sample.test.ts`, `apps/docs/src/scripts/__tests__/pdf-embeds.test.ts` |

No test draws a page: jsdom has no PDF engine, and the Swift and Kotlin code has no native test
target. Check by hand: the web viewer in Chrome, Safari and Firefox (and Android Chrome for the
fallback); a mobile development build on both platforms with a multi-page PDF, a rotated page, a
password-protected file and 300 % zoom.
