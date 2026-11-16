## When to use

- A short list of actions for something on screen: edit, duplicate, share, delete
- Settings that are on or off (checkbox items) or one of a few (radio items)
- An account or workspace menu with a header

## When not to use

- Picking a value for a form: use [Select](/showcase/select)
- Many commands to search: use [Command](/showcase/command)
- Actions on a long press of an area: use [ContextMenu](/showcase/context-menu)

## Notes

- On a phone the menu rises from the bottom as a sheet: in thumb reach, with room for long labels
- Checkbox items keep the sheet open; every other item closes it
- Submenus open in place, with a row back to the menu

## DropdownMenu: actions from a button

`DropdownMenu` is a trigger button and a sheet of rows, built from data (`items`).

### What is it?

A controlled menu: `items` in, `onSelect(value)` out.

### Why use it?

It keeps secondary actions off the screen until they are wanted.

### Features

- **Rows.** Icons, descriptions, trailing text, shortcuts, leading avatars or logos.
- **Kinds.** Actions, checkboxes and radios, with disabled and destructive rows.
- **Groups and submenus.** Headed groups; submenus open in place.
- **Header and footer.** An account summary, a Mark all as read button.
- **Triggers.** Outline, ghost, primary, secondary; icon-only with `size="icon"`.

## Integrating with other components

Put an [Avatar](/showcase/avatar) or an [IconTile](/showcase/icon-tile) in rows, a [ToggleGroup](/showcase/toggle-group) in the header, a [Button](/showcase/button) in the footer.

## Frequently asked questions

### How do I keep the menu open while toggling?

Use `kind: "checkbox"`: those rows leave the sheet open.

### Where does the menu open?

At the bottom of the screen, as a sheet: a phone has no room for menus beside their triggers.
