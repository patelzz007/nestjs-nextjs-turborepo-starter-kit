## When to use

- To confirm what an action just did: saved, archived, sent, deployed.
- To report work that runs in the background and settles later: a deploy, an upload.
- To offer a quick way back from an action that can be undone.

## When not to use

- For an error the user must fix before going on: show it next to the field or in an Alert.
- For a decision the user must make: use an AlertDialog.
- For anything the user must still find later: a toast leaves on its own.

## Notes

- Screens never draw a toast themselves: they call `useToast()` from the app's toast feature, and the app shell's `ToastHost` shows it.
- One toast at a time: a newer one replaces the one on show.
- A toast is announced to screen readers when it appears, with its title.

## Toast

A short message that slides in under the header (or above the home indicator), stays a few seconds, and leaves on its own. It can carry a title, a glyph or an avatar, rich content, action buttons and a progress bar, and it can be rewritten in place while work runs.

### Features

- Tones `default`, `success`, `info`, `warning`, `error` and `loading` (a spinner).
- Looks `soft` (the tone's card), `invert` (a dark card) and `accent` (a thick edge in the tone).
- `durationMs` sets how long it stays; `null` keeps it until it is closed.
- `position` puts it under the header (`top`) or above the home indicator (`bottom`).
- `update(id, …)` rewrites a toast in place; `promise(work, messages)` follows a promise from loading to success or error.
- Swipe it away, or press its close button.

## Integrating with other components

Pass kit `Button`s (size `xs`) as `actions`, an `Avatar` as `leading`, and a `Progress` or a few rows of `Text` as `content`. Keep the toast's own words in `title` and the message.

## Frequently asked questions

### Why can't a screen render a Toast directly?

The toast outlives the screen that showed it (a save, then a navigation back). The app shell owns it, so it survives the navigation and never stacks.

### How do I close a toast from its own action?

Keep the id that `show` (or `success`, `info`…) returns, and call `dismissed(id)` from the action.
