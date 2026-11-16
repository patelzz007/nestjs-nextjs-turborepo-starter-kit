## When to use

- The illustration of an empty state or a first-run screen
- Rich media in a list row or a feature card

## When not to use

- A plain glyph tile beside a label: use IconTile
- Anything that must be read: it is decorative

## Notes

- Decorative: hidden from screen readers; the words around it carry the meaning
- Colours come from the theme (react-native-svg takes values, not classes); nothing is drawn until they resolve

## IconStack

`IconStack` is a layered isometric illustration: three translucent layers in the tone's colour, with a glyph or a small badge printed on the front one.

### Features

- **Tones** `neutral`, `primary`, `success`, `warning`, `destructive`, `info`.
- **Sizes** `xs` to `xl`.
- **Content** printed on the front layer, narrowed and skewed with its face.

## Integrating with other components

Pass it as an EmptyState's `illustration`, or put it at the start of a list row.

## Frequently asked questions

### Why is it hidden from screen readers?

It decorates: the title and message beside it say what is going on.
