## When to use

- Profile pictures and cover banners replaced by one pick or drop, with an instant local preview
- Multi-file drop zones that check type, size and count, then list picks as thumbnails, cards or table rows
- Upload queues with per-file progress and retry, and photo grids put in order by drag before saving

## When not to use

- Chips for files sent with a chat message, in the composer or the reply: use [Attachment](/components/attachment)
- A coloured document icon labelled with its format, such as PDF or XLSX: use [File Type](/components/file-type)

## Notes

- `useFileUpload` keeps picks in React state: sending a `File` to a server is your request to add
- Validation runs on pick and drop (`accept`, `maxSize`, `maxFiles`); validate again on the server
- Previews are object URLs, revoked when a file is removed or the component unmounts

## File Upload: pick, drop, validate and preview files

File upload in the kit is a hook, `useFileUpload`, not a fixed component. It owns the hidden `input`, drag and drop, validation and previews, and returns the state and actions; the examples above compose it into avatars, drop zones, galleries, progress lists, tables and sortable grids.

### What is File Upload?

A headless hook: `const [state, actions] = useFileUpload(options)`. The state holds the files (each with an id, the `File` and a preview URL), the drag state and the errors; the actions open the dialog, add, remove and clear files, and give you props for the input and the drop zone.

### Why use File Upload?

Every upload UI needs the same plumbing — a hidden input, drag and drop, type and size checks, previews and their clean-up — and almost none share a look. A hook keeps the plumbing in one tested place and the markup in yours.

### File Upload features

- **Drag and drop.** `handleDragEnter`, `handleDragLeave`, `handleDragOver` and `handleDrop` for any element.
- **Validation.** `accept`, `maxSize`, `maxFiles` and `multiple`, with readable errors.
- **Previews.** Object URLs for images, cleaned up for you.
- **Initial files.** Show files already uploaded alongside new picks.
- **Helpers.** `formatBytes` and `isFileAccepted`.

## Integrating with other components

Trigger the dialog from a [Button](/components/button), show progress with [Progress](/components/progress), list files in a [Table](/components/table) or as [Item](/components/item)s, mark each format with [File Type](/components/file-type), and reorder images with [Sortable](/components/sortable).

## Frequently asked questions

### Does it upload files?

No. It collects and validates them; you upload each `File` with your API client and track progress yourself, as the Progress List example simulates.

### How do I limit types and sizes?

Pass `accept` (MIME types or extensions), `maxSize` in bytes and `maxFiles`; rejected files appear in `errors`.

### Can I show files that are already uploaded?

Yes: pass them as `initialFiles` (name, size, type and URL), and they appear with the new picks.

### Is it accessible?

The input stays a real file input: trigger it from a labelled button, give the drop zone a visible label, and list files as text so they are read out.
