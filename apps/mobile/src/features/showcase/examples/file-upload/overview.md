## When to use

- Picking documents or photos to upload, checked by type, size and count
- Showing each file's progress and outcome while it uploads
- An avatar, a cover image, a gallery or a list of attachments

## When not to use

- Taking a photo with the camera: use the camera, then `addFiles` the result
- Showing a single file someone already uploaded: use [Attachment](/showcase/attachment)
- Uploading itself: the hook picks and lists files; the app sends them

## Notes

- `useFileUpload` is a hook in `@workspace/ui-native/lib/use-file-upload`; the views are built from the kit's components
- Pickers' answers are validated with zod; a cancelled pick changes nothing

## useFileUpload: picking files to upload

`useFileUpload` opens the document picker or the photo library, keeps the picks that pass the caller's checks (types, size, count) with messages for those that do not, and tracks each file's progress and outcome as the app reports them.

### What is it?

A hook that owns a list of picked files.

### Why use it?

Every upload screen checks and lists files the same way.

### Features

- **Sources.** Documents or photos.
- **Checks.** `accept`, `maxSize`, `maxFiles`.
- **Progress.** `setProgress`, `setStatus`.
- **List.** Remove, move, clear.

## Integrating with other components

Show files with [Attachment](/showcase/attachment), [Progress](/showcase/progress) and [CoverImage](/showcase/cover-image).

## Frequently asked questions

### Does it upload?

No: send each file from `uri` with your API client and report progress with `setProgress` and the outcome with `setStatus`.

### Can people drop files?

A phone has no drag and drop; the picker is how files arrive.
