## When to use

- A section's navigation: a few links, some opening a panel of related links
- Marketing-style menus with described links

## When not to use

- The app's main navigation: use the tab bar or the drawer
- Actions: use [DropdownMenu](/showcase/dropdown-menu)

## Notes

- A group's panel rises in a bottom sheet; a plain link goes straight where it points
- Panels show one or two columns, with an optional footer

## NavigationMenu: links with grouped panels

`NavigationMenu` takes `items`: links, or groups of links with titles, lines and glyphs.

### Features

- **Groups.** Each opens a panel of links.
- **Columns.** One or two.
- **Glyphs and lines.** Per link.
- **Footer.** A Learn more button.

## Integrating with other components

Put a [Button](/showcase/button) in a panel's footer.

## Frequently asked questions

### Why a sheet and not a dropdown?

A phone has no room for panels under a row of links; a sheet is in thumb reach and fits two columns.
