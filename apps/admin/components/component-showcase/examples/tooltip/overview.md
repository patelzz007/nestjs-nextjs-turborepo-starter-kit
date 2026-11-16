## When to use

- Short labels for buttons and icon-only toolbar actions, with a keyboard shortcut where one exists
- Help text on an info icon, a warning, a verified mark, a locked feature or a disabled button
- Compact summaries behind a trigger, such as service status, file details or a person

## When not to use

- Content with links or buttons that keyboard users must reach: use [Popover](/components/popover)
- A rich profile or page preview with a photo, a bio and dates: use [Hover Card](/components/hover-card)
- A status or a count that should stay readable without pointing at anything: use [Badge](/components/badge)

## Notes

- Wrap the app (or a toolbar) in `TooltipProvider` so moving between tooltips opens the next one at once
- `TooltipTrigger` renders a `button` of its own: pass your `Button` through `render` rather than nesting it, or you get a button in a button
- A disabled button cannot be hovered or focused: wrap it in a `span` trigger to explain why it is disabled

## Tooltip: short labels on hover and focus

`Tooltip` shows a short text label next to a control while it is hovered or focused, built on Base UI's tooltip. It is the standard way to name icon-only buttons and to add a hint without cluttering the layout.

### What is Tooltip?

A small, non-interactive bubble: "Bold (⌘B)", "Copied", "Only admins can delete". It opens after a short delay, follows keyboard focus, and closes on Escape.

### Why use Tooltip?

Icon-only toolbars are compact but ambiguous. A tooltip names each icon for sighted users — the same words an `aria-label` gives screen-reader users.

### Tooltip features

- **Positioning.** `side` and `align` on the content, flipping to stay on screen.
- **Shared delay.** `TooltipProvider` makes neighbouring tooltips open instantly once one is open.
- **Shortcuts.** A [Kbd](/components/kbd) inside the content switches to the tooltip's colours.

## Integrating with other components

Name icon-only [Button](/components/button)s and [Toggle](/components/toggle)s, explain a disabled action, and pair a [Badge](/components/badge) or a status dot with its meaning. Use [Kbd](/components/kbd) for the shortcut.

## Frequently asked questions

### Tooltip, Popover or Hover Card?

A tooltip is a text label for a control; a [Popover](/components/popover) opens on click with any content; a [Hover Card](/components/hover-card) previews rich content on hover.

### How do I show a tooltip on a disabled button?

Disabled buttons get no pointer or focus events. Make the trigger a `span` wrapping the button (or use `aria-disabled` instead of `disabled`) so the tooltip can still open.

### Can I change the delay?

Yes: `delay` on `TooltipProvider` (or on the trigger) sets how long the pointer must rest before it opens.

### Do tooltips work on touch screens?

Not reliably — there is no hover. Never put essential information only in a tooltip.

### How do I label an icon-only button?

Give the button an `aria-label` and a tooltip with the same words.
