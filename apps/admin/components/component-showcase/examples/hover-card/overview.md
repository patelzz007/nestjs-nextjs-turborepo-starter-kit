## When to use

- Profile previews on a person's name or avatar, with a photo, a handle, a role and a join date
- Feature, image and release-note previews shown on hover or focus of a link
- Exact dates and times behind a short inline label, such as a relative deploy time in a sentence

## When not to use

- Content opened by a click or a tap, such as a form or settings to change: use [Popover](/components/popover)
- A one-line label that names an icon button: use [Tooltip](/components/tooltip)
- Content that should stay visible in the layout: use [Card](/components/card)

## Notes

- Timing is `delay` and `closeDelay` on `HoverCardTrigger`
- Without `render`, `HoverCardTrigger` renders a link with no `href`, which Tab skips: render a real link or button
- Hover cards do not open on touch; never put the only path to an action inside one

## Hover Card: previews on hover and focus

`HoverCard` shows a rich preview when the pointer rests on — or keyboard focus reaches — a link or a name. It is built on Base UI's preview card, so it waits a moment before opening, stays open while the pointer moves into it, and closes when both are left.

### What is Hover Card?

A floating card for "peek before you click": who someone is, what a link leads to, when something exactly happened. It supplements a link that already works on its own.

### Why use Hover Card?

It answers small questions without a page change — the person's role, the release's notes — keeping people in the flow of what they were reading.

### Hover Card features

- **Delays.** `delay` before opening and `closeDelay` before closing.
- **Positioning.** `side` and `align` on the content, flipping to stay on screen.
- **Rich content.** Avatars, images, text and badges.

## Integrating with other components

Wrap a person's [Avatar](/components/avatar) or name to show their card, show a [Relative Time](/components/relative-time) with its exact time, and preview images with [Aspect Ratio](/components/aspect-ratio).

## Frequently asked questions

### Hover Card, Tooltip or Popover?

A [Tooltip](/components/tooltip) labels a control with text; a hover card previews content on hover; a [Popover](/components/popover) opens on click and can hold interactive content.

### Is it accessible?

It opens on keyboard focus as well as hover, so keyboard users see it. Screen readers get the link itself; keep anything essential out of the card.

### Can it open on click?

No — that is a [Popover](/components/popover). Hover cards only supplement a link.

### How do I stop it being cut off?

It flips and shifts automatically; use `side` and `align` to prefer a position, and `collisionPadding` for extra room.
