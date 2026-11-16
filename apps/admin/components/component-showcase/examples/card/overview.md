## When to use

- Titled sections with body copy and footer actions, such as a help notice or a sign-in form
- Image tiles with a photo above the copy, or filling the tile under a text overlay
- Dashboard widgets such as a KPI with a trend, a usage meter or a deployment status

## When not to use

- A preview that pops up over a link while the pointer rests on it: use [Hover Card](/components/hover-card)
- A grouped panel of rows inside a larger surface: use [Frame](/components/frame)
- A headline number with a trend: use [Stat Card](/components/stat-card) or [KPI Stat Card](/components/kpi-stat-card)

## Notes

- `size="sm"` tightens the padding and gaps of every part at once, before any padding override
- `CardAction` sits in the header's top-right corner, beside the title, for a menu or a link
- Never nest a Card inside a Frame, or a Frame inside a Card: pick one container per surface

## Card: a titled container for related content

`Card` groups related content on a surface: `CardHeader` with `CardTitle`, `CardDescription` and an optional `CardAction`, then `CardContent` and `CardFooter`. Every part pads itself from one variable, so one `size` prop keeps the spacing consistent.

### What is Card?

The basic building block of dashboards and settings pages: a sign-in form, a usage meter, a list of recent orders, a product tile.

### Why use Card?

Cards separate topics on a page and give each a title and actions in predictable places, so a screen of many widgets still reads cleanly.

### Card features

- **Structured parts.** Header, title, description, action, content and footer.
- **Sizes.** `default` and `sm` padding.
- **Images.** Inset, full-bleed and overlaid photos.
- **Borders.** Header and footer separators where content needs them.

## Integrating with other components

Put a [Chart](/components/chart), a [Table](/components/table) or a form of [Field](/components/field)s in `CardContent`; [Button](/components/button)s in `CardFooter`; a [Dropdown Menu](/components/dropdown-menu) in `CardAction`; a [Badge](/components/badge) beside the title.

## Frequently asked questions

### Card or Frame?

A card is a standalone surface with a title and actions; a [Frame](/components/frame) groups panels inside one bordered container. Use one family per surface, not both nested.

### How do I make a whole card clickable?

Put a link in the title and stretch its hit area over the card (`after:absolute after:inset-0`), keeping other interactive elements above it.

### Is it accessible?

It is a plain container: give it a heading (`CardTitle`) so screen-reader users can navigate by sections.
