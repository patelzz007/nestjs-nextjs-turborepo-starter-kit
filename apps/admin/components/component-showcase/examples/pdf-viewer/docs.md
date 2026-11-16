## Installation

`PdfViewer` ships with the kit in `packages/ui/src/components/pdf-viewer.tsx`; there is nothing to install.

```showcase-example
c-pdf-viewer-1
```

## Usage

```tsx
import { PdfViewer } from "@workspace/ui/components/pdf-viewer";
```

```tsx
<PdfViewer source={{ kind: "url", url: invoice.url, fileName: invoice.fileName }} onSourceChange={setSource} className="h-[480px] w-full" />
```

## API Reference

```showcase-api

```

## Accessibility

- Toolbar buttons are named from the `pdfViewer` labels; fullscreen can be left with Escape.
