## When to use

- A colour cue beside a stat, a list row or a navigation item
- The media of a feature card or an empty state
- Initials or a count where a glyph would not say enough

## When not to use

- A status that changes over time: use StatusBadge
- A person's picture: use Avatar

## Notes

- Decorative by default: the label beside it carries the meaning
- With `onPress` it is a control of its own and needs `accessibilityLabel`

## IconTile

`IconTile` is a small square (or circular) surface for one glyph, initials or a count, in a tone that says what the item is about.

### Features

- **Variants** `tint` (default), `outline`, `elevated`, `soft`, `solid`, `frame`.
- **Sizes** `xs` to `xl`; **radius** `full` for a circle.
- **Tones** brand, neutral and seven categorical tones.
- **Text content**, a corner **badge**, and **onPress** for an interactive tile.

## Integrating with other components

Use it in a list row, a StatTiles tile, a KpiStatCard header or an EmptyState's illustration.

## Frequently asked questions

### How do I pick the tone?

By what the item is about: money and active things green, places blue, people violet, time teal, waiting yellow, blocked red, the app's main count brand.

### Why is it hidden from screen readers?

It decorates: the label next to it says what the item is.
