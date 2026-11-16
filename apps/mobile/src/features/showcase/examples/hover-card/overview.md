## When to use

- Previewing a person, a link or a timestamp named in passing
- Extra detail people may want before they open something

## When not to use

- Actions: put them where a tap reaches them, or in a [Popover](/showcase/popover)
- A one-line explanation: use [Tooltip](/showcase/tooltip)

## Notes

- A phone has no hover: a long press opens the card, and a tap outside closes it
- The trigger keeps its own tap (open the profile, follow the link)
- The trigger's hint tells screen readers the preview is there

## HoverCard: a preview on a long press

`HoverCard` is a [Popover](/showcase/popover) opened by a long press, a card wide by default.

### What is it?

A read-only preview anchored to what it describes.

### Why use it?

People can peek without leaving what they are doing.

### Features

- **Long press.** The tap stays the trigger's.
- **Sides.** Like Popover: `side`, `align`, flipping and clamping.

## Integrating with other components

Previews usually hold an [Avatar](/showcase/avatar), a [Badge](/showcase/badge) or an image.

## Frequently asked questions

### Why not open it on a tap?

The tap belongs to the trigger: a hover card adds to what the trigger does, it does not replace it.
