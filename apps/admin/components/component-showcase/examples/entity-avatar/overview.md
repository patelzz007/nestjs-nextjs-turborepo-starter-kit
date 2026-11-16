## When to use

- Organisations, stores, teams and workspaces, shown by their logo or by a generated monogram
- Lists where every entity needs a recognisable mark, logo or not

## When not to use

- A person: use [User Avatar](/components/user-avatar)

## Notes

- With no logo, the monogram's colour is derived from the name, so the same name always gets the same tint
- `shape` is `rounded` (a rounded square, for organisations) by default, or `circle`

## Entity Avatar: a mark for things, not people

`EntityAvatar` shows an organisation's logo, or a coloured monogram generated from its name when there is none. The tint is deterministic, so "Acme Coffee" is always the same colour across the app.

### What is Entity Avatar?

A rounded-square (or round) mark for merchants, stores, teams and workspaces, with the same sizing as the kit's other avatars.

### Why use Entity Avatar?

Many entities have no logo. A stable, coloured monogram makes them distinguishable in lists and switchers, and keeps layouts aligned whether a logo exists or not.

### Entity Avatar features

- **Logo or monogram.** `src` and `sources`, or initials from `name`.
- **Deterministic tint.** `getEntityAvatarTone(name)`.
- **Sizes and shapes.** `size` (`sm` to `xl`), `rounded` or `circle`.

## Integrating with other components

Use it in workspace switchers ([Dropdown Menu](/components/dropdown-menu), [Sidebar](/components/sidebar) headers), [Item](/components/item) rows of merchants, and [Data Table](/components/data-table) cells.

## Frequently asked questions

### Will the colour change if the name's case changes?

No: the tint ignores case and surrounding spaces.

### Is it accessible?

Give it an `alt` with the entity's name, or hide it when the name is beside it.
