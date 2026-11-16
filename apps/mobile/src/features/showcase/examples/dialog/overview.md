## When to use

- One short task that needs full attention: a rename, a two-field edit, a confirmation with details
- A notice that must be read before going on (a session timeout)
- Settings with a few switches (cookie preferences)

## When not to use

- A plain yes or no about a consequential action: use [AlertDialog](/showcase/alert-dialog)
- A task beside the screen, or a long form: use [Sheet](/showcase/sheet) or a screen of its own
- A short message that needs no answer: use [Toast](/showcase/toast)

## Notes

- The dialog is a window of its own: screen readers stay inside it until it closes
- A tap on the scrim or the system back closes it, unless `dismissible` is off or work is `loading`
- `DialogBody` scrolls long content between the header and the footer, which stay in view

## Dialog: a focused window over the screen

`Dialog` is a centred card over a dimmed scrim, built from `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogBody` and `DialogFooter`.

### What is it?

A controlled modal: `open` in, `onOpenChange(false)` out when it asks to close.

### Why use it?

It keeps a short task in place, without leaving the screen.

### Features

- **Parts.** Header, title, description, a scrolling body, a footer stacked or in a row.
- **Close button.** `showCloseButton`, restyled with `closeButtonClassName`.
- **Sizes.** `sm`, `md`, `lg` and `full`.
- **States.** `loading` blocks closing; `invalid` marks a failed outcome.

## Integrating with other components

Put [TextField](/showcase/input), [Switch](/showcase/switch) or [Select](/showcase/select) in it; a select's sheet rises above the dialog.

## Frequently asked questions

### How do I stop a tap outside from closing it?

Pass `dismissible={false}`; the footer's actions are then the only ways out (the system back still asks to close).

### Where do the buttons go?

In `DialogFooter`: stacked with the primary action first, or side by side with `layout="row"`.
