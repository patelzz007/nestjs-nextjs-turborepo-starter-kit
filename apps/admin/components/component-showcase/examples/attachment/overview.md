## When to use

- Files carried by a chat turn, as chips in a composer tray or cards in an assistant reply
- Upload queues and pickers where each file reads as idle, uploading, processing, failed or done
- Rows of image thumbnails or file chips that scroll sideways on one line instead of wrapping

## When not to use

- A drop zone that takes files dragged in from the desktop: use [File Upload](/components/file-upload)
- A coloured format icon on its own: use [File Type](/components/file-type)
- An upload list where each row needs a bar filling to 100%: use [Progress](/components/progress)

## Notes

- `Attachment` uploads nothing: it only styles the `state` you pass, so set `state` from your own transfer code
- Actions are kit buttons; inside a `form`, keep them `type="button"` (the default)

## Attachment: files in conversations and queues

`Attachment` shows one file as a chip or a card: media (a thumbnail or a file-type icon), a title, a description and actions. Its `state` — idle, uploading, processing, error, done — sets the styling and the status text, and `AttachmentGroup` lays several in a wrapping row or a sideways scroller.

### What is Attachment?

The file chip of a chat composer and the file card of a message. `AttachmentTrigger` makes the whole attachment open a preview; `AttachmentAction`s remove, retry or download.

### Why use Attachment?

Files in conversations need a compact, consistent look and clear states, especially while uploading or after a failure.

### Attachment features

- **States.** Idle, uploading, processing, error and done.
- **Three sizes.** From a small chip to a card.
- **Media.** Image thumbnails or [File Type](/components/file-type) icons.
- **Groups.** Wrapping rows or a horizontal scroller.

## Integrating with other components

Show attachments in a [Message](/components/message) or a composer [Input Group](/components/input-group), with [File Type](/components/file-type) icons as media; collect files with [File Upload](/components/file-upload).

## Frequently asked questions

### Does it upload files?

No: run the upload yourself and set `state` (and progress text) as it goes.

### Is it accessible?

The title and the state are text; actions are named buttons; a trigger that opens a preview is a button too.
