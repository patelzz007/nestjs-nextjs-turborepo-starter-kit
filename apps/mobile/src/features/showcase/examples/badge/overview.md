## When to use

- A status or a category in a word or two: Paid, Beta, New
- Counts and tags
- Removable filters

## When not to use

- A status that changes over time (online, failed): use [StatusBadge](/showcase/status-badge)
- A sentence: use [Alert](/showcase/alert)
- An action: use [Button](/showcase/button)

## Notes

- `tone` is what it is about; `variant` how loudly it says it
- Colour is never the only signal: the label says it
- A removable badge's X is its own button

## Badge: a short label

`Badge` takes a `label`, a `tone` and a `variant`.

### Features

- **Tones.** Neutral, primary, info, success, warning, destructive.
- **Variants.** Soft, light, solid, outline.
- **Sizes and shapes.** sm, md, lg; pill or rounded.
- **Extras.** A glyph, a status dot, an avatar or flag, a remove button, a link.

## Integrating with other components

Badges sit in [Card](/showcase/card)s, table rows, [Tabs](/showcase/tabs) and list rows.

## Frequently asked questions

### Badge or StatusBadge?

A Badge is a fixed label; a StatusBadge shows a state that changes, with its glyph and an optional pulse.
