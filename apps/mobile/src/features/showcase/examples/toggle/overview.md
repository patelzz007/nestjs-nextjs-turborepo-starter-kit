## When to use

- An option that stays on or off and acts at once, such as bold in an editor or a bookmark
- A reaction or a pin that shows whether it is on, with its count
- A mute or a follow control whose glyph and label follow its state

## When not to use

- A setting in a list of settings: use [Switch](/showcase/switch)
- One choice out of several: use [ToggleGroup](/showcase/toggle-group)
- An action that does something once rather than staying on: use [Button](/showcase/button)

## Notes

- A toggle is controlled: pass `pressed` and update it from `onChange`
- Screen readers hear a toggle button and whether it is on; `pressedLabel` changes the name with the state

## Toggle: on and off in one press

`Toggle` is a two-state button: pressed or not. It shows its state by its fill (borderless, outlined or a pill), and can swap its glyph (`pressedIcon`) and label (`pressedLabel`) while pressed.

### What is it?

A button that stays down. Pressing it flips `pressed`; the caller keeps the state and passes it back.

### Why use it?

Formatting marks, reactions and pins are choices people make and see at a glance. A toggle shows the state on the control itself, where a switch would need a label beside it.

### Features

- **Three looks.** `default` (borderless until pressed), `outline`, `pill`.
- **Three sizes.** `sm` (44 pt touch area), `md`, `lg`.
- **Glyph and label swap.** `pressedIcon` and `pressedLabel`.
- **Slots.** `trailing` holds a count or a badge.
- **States.** Disabled, loading and invalid, like a button.

## Integrating with other components

Join several into one choice with [ToggleGroup](/showcase/toggle-group). Explain an icon-only toggle with a [Tooltip](/showcase/tooltip) (`asChild`).

## Frequently asked questions

### Toggle or Switch?

A toggle acts on the content in front of it (bold, like, pin); a [Switch](/showcase/switch) sets a preference in a settings list. Both take effect at once.

### How is the state read out?

As a toggle button that is checked or not. With `pressedLabel` the name changes too ("Bookmark" → "Bookmarked").

### Can a toggle show a count?

Yes: put it in `trailing`, and say it in `accessibilityHint` so it is read out.
