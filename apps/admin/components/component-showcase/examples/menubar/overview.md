## When to use

- Desktop-style command bars of File, Edit and View menus, with key hints and side flyouts
- Formatting and insert menus for a document editor, such as Bold, Italic, Media and Link
- View toggles and single-choice settings kept in the top bar, such as panels or the theme

## When not to use

- A single list of actions opened from one button: use [Dropdown Menu](/components/dropdown-menu)
- Commands opened by right-clicking a file, a row or a canvas: use [Context Menu](/components/context-menu)
- Site navigation between pages: use [Navigation Menu](/components/navigation-menu)

## Notes

- Give each `MenubarItem` its command through `onClick`
- `MenubarShortcut` only prints the chord: register the keys in your own keydown listener
- `MenubarLabel` must sit inside a `MenubarGroup` or a `MenubarRadioGroup`

## Menubar: an application menu bar

`Menubar` is a row of menus like a desktop app's File, Edit and View, built on Base UI's menubar and menu. Once one menu is open, moving the pointer or the arrow keys to the next opens it at once.

### What is Menubar?

`MenubarMenu`s, each a `MenubarTrigger` and a `MenubarContent` of items — actions, checkboxes, radio groups and submenus — with shortcuts and separators.

### Why use Menubar?

Editors and tools with many commands benefit from the familiar menu-bar layout: commands are grouped by topic, discoverable, and fully keyboard-operable.

### Menubar features

- **Item types.** Actions, checkboxes, radio groups and submenus.
- **Shortcuts.** `MenubarShortcut` for the key hint.
- **Roving menus.** Arrow keys move between menus once one is open.

## Integrating with other components

Place it above an editor or a [Resizable](/components/resizable) workspace, show [Kbd](/components/kbd)-style hints, and confirm destructive commands with an [Alert Dialog](/components/alert-dialog).

## Frequently asked questions

### Menubar or Dropdown Menu?

A menubar for an app with many grouped commands; a [Dropdown Menu](/components/dropdown-menu) for a handful of actions on one button.

### Do the shortcuts work by themselves?

No: `MenubarShortcut` is a label. Bind the keys with a keydown handler that calls the same functions as the items.

### Is it accessible?

Yes: `role="menubar"` with `menu`s; the arrow keys move between and within menus, Enter activates, Escape closes.
