## When to use

- Naming a hardware keyboard shortcut next to the action it runs, for iPad, Chromebook and Android with a keyboard attached
- A list of the screen's shortcuts in a help sheet
- A key a field answers to, at the start of the field

## When not to use

- Text a person types or a code they copy: use [CodeBlock](/showcase/code-block) or the kit's code text role
- A button that runs the shortcut's action: use [Button](/showcase/button) and put the keys in it
- Any key on a phone with no keyboard attached: there is nothing to press

## Notes

- `Kbd` is never pressable and never read out on its own; `KbdGroup` is read only when given an `accessibilityLabel`
- Write the keys as printed on the keyboard (⌘, ⇧, Ctrl) and say them in words for screen readers

## Kbd: keyboard shortcuts on a tablet

`Kbd` draws one key of a hardware keyboard as a small cap; `KbdGroup` sets a chord's keys side by side. Phones and tablets with a keyboard attached answer to shortcuts, and these are how a screen names them — in a button, a tooltip or a list.

### What is it?

A key cap: the key's name, optionally led by a glyph, in the label type on the muted fill. `tone="inverse"` draws it inside a dark tooltip.

### Why use it?

A shortcut written as caps reads at a glance and looks the same everywhere it appears. Keeping it a kit component keeps every cap the same size and colour.

### Features

- **One key.** `Kbd` with a `label`, an optional glyph and two sizes.
- **Chords.** `KbdGroup` with `keys`, named for screen readers by `accessibilityLabel`.
- **Inverse tone.** For a cap inside a tooltip's dark bubble.
- **Inert.** Never pressable, hidden from screen readers unless the group is named.

## Integrating with other components

Put a `KbdGroup` in a [Button](/showcase/button)'s `trailing` slot for a launcher, or pass `shortcut` to a [Tooltip](/showcase/tooltip). A field shows the key that focuses it through [Input](/showcase/input)'s `leading` slot.

## Frequently asked questions

### Do phones have keyboard shortcuts?

When a hardware keyboard is attached, yes: iPadOS, ChromeOS and Android pass key presses to the app. Without one, a shortcut hint is noise, so show it where a keyboard is likely (a tablet layout) or in a help sheet.

### How do screen readers read a shortcut?

A lone `Kbd` is hidden from them. Give the `KbdGroup` an `accessibilityLabel` in words ("Command K"), or say the shortcut in the control's own name or hint.
