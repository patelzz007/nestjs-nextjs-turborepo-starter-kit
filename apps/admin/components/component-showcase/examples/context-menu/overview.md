## When to use

- Right-click actions on a file, a row or a canvas area, such as copy, paste, share and delete
- Toggles and single-choice settings changed from a right click, such as visible bars or the theme
- Long command lists split into labelled sections, key hints or a nested flyout of extra tools

## When not to use

- Actions that must stay discoverable, opened from a visible button such as a row's ⋯ icon: use [Dropdown Menu](/components/dropdown-menu)
- A persistent bar of File, Edit and View menus across the top of an app window: use [Menubar](/components/menubar)

## Notes

- Wrap the row or card in `ContextMenuTrigger`, or pass the target through `render`
- `ContextMenuLabel` must sit inside a `ContextMenuGroup` or a `ContextMenuRadioGroup`
- Right-click menus are hidden: always offer the same actions somewhere visible too

## Context Menu: actions on right click and long press

`ContextMenu` opens a menu at the pointer when an element is right-clicked or long-pressed, built on Base UI's context menu. It has the same items as [Dropdown Menu](/components/dropdown-menu) — actions, checkboxes, radios, submenus, shortcuts — positioned where people clicked.

### What is Context Menu?

The menu desktop users expect on right click: in file lists, tables, canvases and editors. On touch devices, a long press opens it.

### Why use Context Menu?

It puts the relevant actions exactly where people are working, without spending space on buttons. Power users rely on it; everyone else should find the same actions elsewhere.

### Context Menu features

- **Item types.** Actions, checkboxes, radio groups and submenus.
- **Labels, groups and separators.** For long menus.
- **Shortcuts and destructive items.** As in the dropdown menu.

## Integrating with other components

Wrap [Table](/components/table) rows, [Card](/components/card)s or [Tree](/components/tree) items in a trigger; confirm destructive actions with an [Alert Dialog](/components/alert-dialog); mirror the actions in a [Dropdown Menu](/components/dropdown-menu) on a visible button.

## Frequently asked questions

### Where should `ContextMenuTrigger` go?

Around the element people right-click — a row, a card, a canvas — or pass that element through `render`.

### How do I confirm a destructive action?

Open an [Alert Dialog](/components/alert-dialog) from the item's `onClick`, and act only on confirm.

### Does it work on touch devices?

Yes, a long press opens it. Still provide a visible menu button, since a long press is hard to discover.

### Is it keyboard-accessible?

Yes once open: the arrow keys, Enter and Escape work as in any menu. Keyboard users can open it with the context-menu key or Shift F10 on the focused trigger.
