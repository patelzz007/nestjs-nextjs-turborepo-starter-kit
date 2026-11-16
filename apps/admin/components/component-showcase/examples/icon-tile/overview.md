## When to use

- Square media for list rows, feature cards and empty states, held to one size and radius
- Status and brand markers in a soft tint, a solid fill or a theme colour
- Compact initials or counts, and icons with a status dot pinned to one corner

## When not to use

- A layered isometric illustration for an empty state: use [Icon Stack](/components/icon-stack)
- Markers for each step of a flow, with active and completed states: use [Stepper](/components/stepper)

## Notes

- The tile sizes its own child `svg`, so the icon needs no size class in the common case
- Mark a purely decorative tile `aria-hidden="true"` and keep the meaning in the surrounding text

## Icon Tile: a square home for an icon

`IconTile` gives an icon a square surface with a consistent size, radius and treatment. Tones (`brand`, `neutral`, `blue`, `green`, `yellow`, `red`, `orange`, `teal`, `violet`) and variants (`tint`, `soft`, `solid`, `outline`, `elevated`, `frame`) cover everything from a quiet list-row icon to a bold feature mark.

### What is Icon Tile?

A small container for one glyph — or initials, or a count — used as row media, a card's icon, a settings entry's marker or an empty state's art.

### Why use Icon Tile?

Bare icons float. A tile gives them weight, alignment and a colour that carries meaning, and keeps every row in a list the same size.

### Icon Tile features

- **Tones.** `brand`, `neutral` and seven palette colours.
- **Variants.** `tint`, `soft`, `solid`, `outline`, `elevated` and `frame` — combinable as an array.
- **Sizes and shapes.** From `xs` to `xl`, square or circular.
- **Content.** Icons, initials, counts, and a corner status dot.

## Integrating with other components

Use it as `ItemMedia` in [Item](/components/item) rows, beside a [Card](/components/card) title, in [Stat Card](/components/stat-card)s (they use it), and as the media of an [Empty](/components/empty) state.

## Frequently asked questions

### Do I size the icon?

No: the tile sizes its child `svg` to the tile's size. Pass a size class only to override it.

### Is it accessible?

It is decorative by default: hide it with `aria-hidden` and keep the meaning in text. A tile that stands alone (a count) needs its own label.
