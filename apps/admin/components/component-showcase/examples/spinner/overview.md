## When to use

- Pending states inside buttons, status badges and search fields while a request runs
- Loading views for a card or an empty panel, including a blurred cover over content being refreshed
- Inline notes such as checking, syncing or reconnecting, led by a small spinner

## When not to use

- Content of a known layout, held as placeholder shapes until it arrives: use [Skeleton](/components/skeleton)
- A wait where the share of work done is known, such as an upload: use [Progress](/components/progress)
- A button that is busy: pass `loading` to the [Button](/components/button), which draws its own spinner

## Notes

- `Spinner` is announced as "Loading" by default; pass `aria-hidden` when visible text already says so
- Lock the controls a pending request affects from your own request state, not just with the spinner

## Spinner: an indeterminate wait

`Spinner` is a small rotating indicator for work of unknown length. It inherits the text colour and size of where it sits, so it fits in a button, a badge, an input or a heading.

### What is Spinner?

An animated icon with `role="status"` and a localised "Loading" label, sized by classes like any icon.

### Why use Spinner?

People need to know the app is working. A spinner says so in the smallest space, right where the result will appear.

### Spinner features

- **Inherits colour and size.** `size-*` and text colours.
- **Announced.** `role="status"` with a localised label.

## Integrating with other components

Put it in an [Input Group](/components/input-group) addon while a lookup runs, in a [Badge](/components/badge) for "Syncing", or centred in an [Empty](/components/empty) state. [Button](/components/button)s use it for `loading`.

## Frequently asked questions

### Spinner or Skeleton?

A [Skeleton](/components/skeleton) when you know the layout that is coming; a spinner when you do not, or for a short inline wait.

### Is it accessible?

It is `role="status"` named "Loading"; hide it (`aria-hidden`) when nearby text already announces the wait, so it is not read twice.
