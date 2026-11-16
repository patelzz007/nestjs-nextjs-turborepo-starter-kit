## When to use

- An editor's toolbar: File, Edit, View
- Formatting and insert menus over a document

## When not to use

- One menu: use [DropdownMenu](/showcase/dropdown-menu)
- Navigation: use [NavigationMenu](/showcase/navigation-menu)

## Notes

- Each menu rises in a bottom sheet, with every DropdownMenu row kind
- The strip scrolls sideways if the menus do not fit

## Menubar: a row of menus

`Menubar` takes `menus`, each with a label, items and its own `onSelect`.

### Features

- **Row kinds.** Icons, shortcuts, checkboxes, radios, groups, submenus.
- **Look.** An outlined strip, or plain triggers.

## Integrating with other components

Each menu is a [DropdownMenu](/showcase/dropdown-menu).

## Frequently asked questions

### Can a menu hold checkboxes?

Yes: `kind: "checkbox"` rows keep the sheet open as they change.
