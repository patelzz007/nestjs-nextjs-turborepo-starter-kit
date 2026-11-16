## When to use

- Previewing PDFs in place — invoices, contracts, verification documents — without downloading them
- Documents people may also open in a new tab, download or view fullscreen

## When not to use

- Editing or annotating PDFs: this shows them
- Images: use [Cover Image](/components/cover-image) or [Aspect Ratio](/components/aspect-ratio)

## Notes

- It renders the browser's built-in PDF engine inside the kit's toolbar; browsers without one get a download fallback
- `source` is `{ kind: "url", url, fileName }` or `{ kind: "file", file }`; `onSourceChange` receives a file the reader opens from their device

## PDF Viewer: documents in place

`PdfViewer` shows a PDF inside the kit's own toolbar — the file's name, open from device, open in a new tab, download and fullscreen — around the browser's built-in PDF engine.

### What is PDF Viewer?

An embedded document viewer for review screens. It needs no PDF library: the browser renders the pages, and the kit supplies a consistent toolbar and states.

### Why use PDF Viewer?

Reviewing a document should not mean downloading it. An in-page viewer with the same toolbar everywhere keeps review flows quick.

### PDF Viewer features

- **Toolbar.** Name, open, new tab, download, fullscreen.
- **Open from device.** Preview a local file.
- **Fallbacks.** A download for browsers that cannot show PDFs inline.
- **Localised.** Labels from the `pdfViewer` messages.

## Integrating with other components

Show it in a [Dialog](/components/dialog) or a [Sheet](/components/sheet) for review, beside approve and reject [Button](/components/button)s.

## Frequently asked questions

### Does it work on mobile?

Where the browser can show PDFs inline, yes; elsewhere it offers to open or download the file.

### Is it accessible?

The toolbar buttons are named; the document's own accessibility depends on the PDF and the browser's engine.
