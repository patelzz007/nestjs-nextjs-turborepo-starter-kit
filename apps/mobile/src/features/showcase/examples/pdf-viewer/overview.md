## When to use

- Previewing documents in the app: invoices, contracts, statements

## When not to use

- Documents people edit: hand them to another app

## Notes

- Pages are drawn by the phone's own PDF engine (the app's native module); in Expo Go the document is offered to another app instead
- Page steps, zoom, search and download where the engine can

## PdfViewer

`PdfViewer` shows a PDF page by page, with page steps, zoom and search, or offers it to another app when the phone cannot draw it.

### Features

- **States**: loading, failed (with retry), external, ready.
- **Search** in the text.
- **Download** a copy.

## Integrating with other components

Open it from an Attachment or a list; the app's PDF feature picks or downloads the file.

## Frequently asked questions

### What happens in Expo Go?

There is no PDF engine, so the viewer offers to open the document in another app.
