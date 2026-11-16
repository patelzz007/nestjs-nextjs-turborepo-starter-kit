## When to use

- Attachment lists, upload queues and file-browser rows, each icon resolved from a name or a MIME type
- Export-format pickers and legends of the formats a product accepts or produces
- Version tags, document codes and marks such as a lock or a star drawn on a document

## When not to use

- A drop zone or picker that collects files: use [File Upload](/components/file-upload)
- Files attached to a chat message, with upload states: use [Attachment](/components/attachment)

## Notes

- `type` takes an extension, not a file name: run names through `getFileType("Q3 report.xlsx")` first
- `FileType` is not focusable; put an action on a wrapping button or link with its own name

## File Type: a document icon for every format

`FileType` draws a document icon labelled and coloured by format — PDF in red, XLSX in green, ZIP, MP4, SVG and dozens more — resolved from an extension. `getFileType` and `getFileTypeCategory` resolve names and MIME types.

### What is File Type?

A recognisable page-with-a-corner icon whose colour and label say the format. Variants (`outline`, `solid`, `mono`) and sizes fit it to list rows, cards and pickers.

### Why use File Type?

People scan file lists by format. A consistent, labelled icon is faster to read than an extension in grey text, and needs no image assets.

### File Type features

- **Dozens of formats.** Grouped by family: documents, sheets, images, media, archives, code.
- **Variants and sizes.** `outline`, `solid`, `mono`; several sizes.
- **Resolvers.** From a file name or a MIME type.
- **Custom labels, colours, icons and badges.**

## Integrating with other components

Use it as `ItemMedia` in [Item](/components/item) rows, in [File Upload](/components/file-upload) lists, and in [Table](/components/table) cells of a file browser.

## Frequently asked questions

### What if the format is unknown?

It draws a neutral page with the extension as its label.

### Is it accessible?

It is an image labelled with its format; when the file name is beside it, hide it from assistive technology to avoid repetition.
