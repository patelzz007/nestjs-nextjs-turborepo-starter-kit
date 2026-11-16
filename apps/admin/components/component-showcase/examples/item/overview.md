## When to use

- Rows of people, files, services or events, each an avatar or an icon beside text, a badge or a button
- Clickable menus of account pages, mailbox folders or commands, ending in a chevron, a count or a key
- A compact record card with a header and a footer, such as a project with status, team and progress

## When not to use

- Rows people reorder by dragging: use [Sortable](/components/sortable)
- Rows people sort, filter and page: use [Data Table](/components/data-table)

## Notes

- Make a row a link through `render` (`<Item render={<a href="…" />}>`); the hover fill appears only when the row is a link
- `ItemGroup` sets `role="list"` but `Item` sets no `listitem` role: wrap each row in an element that carries it, or render items as `li`
- `ItemTitle` clamps to one line and `ItemDescription` to two; lift the clamp with a class for longer text

## Item: a flexible row

`Item` lays out one row of content: `ItemMedia` (an avatar, an icon or an image), `ItemContent` with `ItemTitle` and `ItemDescription`, and `ItemActions` at the end. `ItemHeader` and `ItemFooter` turn it into a small card.

### What is Item?

The row of every list: a teammate with a Follow button, a file with its size, a settings link with a chevron, an integration with a switch. Variants (`default`, `outline`, `muted`) and sizes fit it to the surface.

### Why use Item?

Lists drift when each one lays out its rows by hand. `Item` gives media, text and actions fixed places and spacing, so lists across the app line up.

### Item features

- **Media, content and actions.** In fixed slots.
- **Variants and sizes.** `default`, `outline`, `muted`; `default`, `sm`, `xs`.
- **Groups and separators.** `ItemGroup` and `ItemSeparator`.
- **Links.** `render` makes the row a link with a hover state.

## Integrating with other components

Use [Avatar](/components/avatar)s and [Icon Tile](/components/icon-tile)s in `ItemMedia`, [Badge](/components/badge)s and [Button](/components/button)s in `ItemActions`, and [Kbd](/components/kbd) for shortcuts. Group rows in a [Card](/components/card) or a [Frame](/components/frame).

## Frequently asked questions

### How do I make a row clickable?

Render it as a link: `render={<a href="/settings/profile" />}` (or your router's link).

### Is it accessible?

Use a list structure (`ItemGroup` with `li` rows) so screen readers announce the count, and keep actions as real buttons inside the row.
