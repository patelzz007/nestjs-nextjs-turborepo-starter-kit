## When to use

- Brief feedback after an action, such as a created record or an archived message with Undo
- The progress of async work in one toast that updates in place, from loading to success or failure
- Rich notifications for messages, invites, deploys and builds, with their own buttons

## When not to use

- A status or warning that must stay on the page until it is fixed: use [Alert](/components/alert)
- A choice people must make before continuing: use [Alert Dialog](/components/alert-dialog)

## Notes

- The app mounts one `Toaster` in its providers; call `toastMessage.success(...)` (or `toast.add(...)`) from anywhere
- `toastMessage.loading` returns an id: pass it to `toastMessage.update` to turn the same toast into the result
- Toasts pause while hovered or focused, and stack in their corner

## Toast: notifications that come and go

The kit's toasts are built on Base UI's toast manager: a `Toaster` renders them in a corner, and `toastMessage` (or the lower-level `toast` manager) adds, updates and closes them from anywhere — event handlers, mutations, effects.

### What is Toast?

A small notification that slides in, says what happened — "Merchant saved", "Upload failed" — maybe offers an action like Undo, and leaves on its own. Types (`success`, `error`, `warning`, `info`, `loading`) set the icon and colour.

### Why use Toast?

Actions need confirmation without interrupting the work. A toast says "done" — or "that failed, retry?" — and gets out of the way.

### Toast features

- **Typed helpers.** `toastMessage.success`, `error`, `warning`, `info`, `loading` and `update`.
- **Promises.** One toast from loading to success or error.
- **Actions and close.** `ToastAction` for Undo or Retry; a close button.
- **Rich content.** Avatars, progress bars and countdowns.
- **Positions and durations.** Any corner; per-toast timeout.
- **Accessible.** Announced in a live region; paused on hover and focus.

## Integrating with other components

Call it from TanStack Query mutations' `onSuccess` and `onError`, show an [Avatar](/components/avatar) for message toasts, and a [Progress](/components/progress) bar for uploads.

## Frequently asked questions

### How do I show a toast?

`toastMessage.success({ title: "Saved", description: "Acme Coffee was updated." })` anywhere in client code.

### How do I show progress and then the result?

`const id = toastMessage.loading({ title: "Uploading…" })`, then `toastMessage.update(id, { type: "success", title: "Uploaded" })`.

### Can a toast have an action?

Yes: pass an action (Undo, Retry) and handle it; keep the action available elsewhere too, since toasts disappear.

### Are toasts accessible?

They are announced through a live region, pause while hovered or focused, and can be reached with the keyboard shortcut to focus the toast region.
