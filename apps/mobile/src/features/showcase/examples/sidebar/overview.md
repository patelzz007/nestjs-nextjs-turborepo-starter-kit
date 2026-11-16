## When to use

- An app's main navigation in a drawer or on a tablet
- Docs navigation with sections and search
- An inspector beside a record (in a Sheet)

## When not to use

- A phone's main navigation: the tab bar is closer to hand
- A short menu: use [DropdownMenu](/showcase/dropdown-menu)

## Notes

- Search narrows the items, opening every sub-menu that still matches, and keeps pinned items
- Collapsed, it is an icon rail: glyphs only, still named
- It is the panel's content: put it in a [Sheet](/showcase/sheet) from the left for a drawer

## Sidebar: an app's navigation panel

`Sidebar` takes `groups` of items, with a header, a footer, a search and loading and empty states.

### Features

- **Items.** Glyphs, counts, the current page, sub-menus.
- **Search.** With pinned items and an empty message.
- **Icon rail.** `collapsed`.
- **Looks.** Panel, inset, plain.

## Integrating with other components

Put a [DropdownMenu](/showcase/dropdown-menu) workspace switcher in the header, and a [Progress](/showcase/progress) bar or an [Avatar](/showcase/avatar) in the footer.

## Frequently asked questions

### Where does it go on a phone?

In a Sheet from the left (a drawer), or as a screen of its own.
