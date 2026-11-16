## When to use

- A row of content with media, a title and a description, and actions
- People, files, integrations, activity: anything listed with a few facts and a control
- A compact card with a header and footer row

## When not to use

- A settings list of tappable rows on one surface: use ListGroup with ListRows
- A grid of large tiles: use Card

## Notes

- Media is decorative; the title names the row
- With `onPress` the whole row is a named link (or button): then give it no buttons of its own

## Item

`Item` is a row of content: leading media, a title and a description, trailing actions, and optional full-width header and footer rows.

### Features

- **Variants** `default`, `outline`, `muted`.
- **Sizes** `md`, `sm`, `xs`; the parts follow the item's size.
- **Media** unframed, an `icon` tile, or an `image` thumbnail.
- **ItemGroup** and **ItemSeparator** stack rows.

## Integrating with other components

Put Avatars, Icons or IconTiles in the media; Buttons, Badges, a Kbd or a DropdownMenu in the actions.

## Frequently asked questions

### Item or ListRow?

ListRow for a tappable settings row in a ListGroup; Item for a row of content with its own actions.
