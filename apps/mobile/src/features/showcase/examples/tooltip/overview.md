## When to use

- Explaining an icon-only control in a few words
- Saying why a control is unavailable
- Detail about a status, a file or a person that fits in a bubble

## When not to use

- Anything to tap (a link, a button): use [HoverCard](/showcase/hover-card) or [Popover](/showcase/popover)
- Essential information: put it on the screen
- Long text: use a [Popover](/showcase/popover)

## Notes

- A phone has no hover: the bubble shows while the element is pressed and held, and goes when the finger lifts
- Screen readers hear the text as the element's hint, so nobody needs the gesture
- With `asChild`, a control (Button, IconButton, Toggle) takes the long press itself

## Tooltip: a short explanation while held

`Tooltip` shows `content` in a bubble above or below what it explains.

### What is it?

An inverted bubble with a line of text, a keyboard shortcut, or richer content.

### Why use it?

Icon-only controls save room; a tooltip says what they do.

### Features

- **Above or below.** `side`.
- **Controls.** `asChild` hands the long press to the control.
- **Shortcuts.** `shortcut` adds key caps.
- **Rich content.** `richContent` draws badges, an avatar or a short list; `content` stays the hint.

## Integrating with other components

Wrap an [IconButton](/showcase/button), an [Avatar](/showcase/avatar) or a status icon.

## Frequently asked questions

### Can a tooltip hold a link?

No: it goes when the finger lifts. Use a [HoverCard](/showcase/hover-card).

### How do I explain a disabled button?

Wrap it in the tooltip (not `asChild`): the wrapper takes the long press, which a disabled button does not.
