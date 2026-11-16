## When to use

- A file's type at a glance in a list, an upload queue or an attachment row
- A document code or a version tag on a page (`label`)

## When not to use

- A picture of the file itself: show a thumbnail
- A status of the file (uploading, failed): say it in text beside the icon

## Notes

- Pass a file name, path, URL or MIME type through `getFileType` (@workspace/shared) first
- The type table and the rules are shared with the web, so both draw the same icon for a file

## FileType

`FileType` is a page in the type's tone with its extension label or its family's glyph, named for screen readers after the type.

### Features

- **Variants** `outline`, `light`, `solid`, `mono`.
- **Sizes** `mini` (18 pt) to `xl` (56 pt).
- **Label** override or hide; **glyph** mode; a custom **icon**; a **tone** override.
- **Labels** for the spoken name in any language.

## Integrating with other components

Put it in an Item's media, a list row or an input's leading slot; hide it from screen readers (inside ItemMedia) when the name beside it already says the type.

## Frequently asked questions

### How do I get the type from a file name?

`getFileType("Q3 report.pdf")` from @workspace/shared reads names, paths, URLs and MIME types the same way the web does.
