## When to use

- Artwork for first-run and no-data screens, in the media slot above the message
- Compact media for list rows, such as a package entry in an outlined row
- Decorative marks with more depth than a flat icon, tinted by a theme colour or topped with a badge

## When not to use

- A flat square that keeps one icon the same size across rows: use [Icon Tile](/components/icon-tile)
- A no-data message with a title, a description and actions: use [Empty](/components/empty), with an icon stack as its media

## Notes

- A text colour on `IconStack` reaches only the layer outlines and shadow; the inner content is muted by default
- Keep its 72 × 81 aspect ratio when resizing: the content is placed by percentage of the box
- The content layer is skewed and has no pointer events, so a button or link placed there gets no clicks

## Icon Stack: a layered isometric icon

`IconStack` draws an isometric stack of layers with one icon (or small content) on top. It turns a plain glyph into a little illustration for empty states, onboarding and feature cards.

### What is Icon Stack?

An SVG of stacked plates with an overlay slot. Put a Lucide icon in it, tint it with a colour, add a badge.

### Why use Icon Stack?

Empty states and first-run screens benefit from art, but custom illustrations are costly. An icon stack gives depth from any icon, consistently.

### Icon Stack features

- **Any icon or content** on top.
- **Sizes and colours.** Through classes.
- **Badge overlay.** A count or a status on a corner.

## Integrating with other components

Use it as the media of an [Empty](/components/empty) state or an [Item](/components/item) row.

## Frequently asked questions

### Can it be interactive?

No: the content layer takes no pointer events. Put actions beside it.

### Is it accessible?

It is decorative: mark it `aria-hidden` and say the meaning in text.
