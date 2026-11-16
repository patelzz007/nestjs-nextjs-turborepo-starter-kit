## When to use

- Files in chats, composers and upload queues

## When not to use

- A file browser: use DataGrid with FileType icons

## Notes

- Data-agnostic: the caller formats the detail, runs the actions and reports the upload's `state`
- States from the web: queued (dashed), uploading, processing, failed and done

## Attachment

`Attachment` shows one file as a chip or a card: a glyph or an image preview, its name and detail, actions and a remove button.

### Features

- **Upload states** with matching looks.
- **Image previews** and a vertical card for strips.
- **Actions** (download, retry, cancel) and **remove**.
- **Sizes** md, sm, xs.

## Integrating with other components

Put chips in a composer's tray, a message's footer, or a list of uploads; pair with expo-document-picker to add files.

## Frequently asked questions

### Does it upload files?

No: it shows where an upload is. The caller uploads and sets `state`.
