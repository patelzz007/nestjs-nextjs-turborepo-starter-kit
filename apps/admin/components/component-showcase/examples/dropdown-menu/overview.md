## When to use

- Action and overflow menus on a button or a dots icon, such as edit, duplicate, share, export and delete
- Account, workspace and create menus showing the signed-in user, workspace switching and sign-out
- Toggles, exclusive choices and short lists, such as panel layout, theme or an AI model

## When not to use

- Actions opened by right-clicking or long-pressing a surface, with no button: use [Context Menu](/components/context-menu)
- A value kept in a form field: use [Select](/components/select) or [Combobox](/components/combobox)
- Site navigation with panels: use [Navigation Menu](/components/navigation-menu)

## Notes

- `DropdownMenuLabel` must sit inside a `DropdownMenuGroup` or a `DropdownMenuRadioGroup`
- Run an item's action from `onClick`
- Pass the trigger element through `render`, e.g. `<DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>`

## Dropdown Menu: actions and choices from a button

`DropdownMenu` opens a menu of actions from a trigger, built on Base UI's menu: the arrow keys move through items, typing jumps to an item, submenus open to the side, and Escape closes it. Items can be actions, checkboxes or radio choices, with icons and shortcuts.

### What is Dropdown Menu?

The "⋯" menu, the account menu, the "New ▾" menu. `DropdownMenuItem`s run actions; `DropdownMenuCheckboxItem` and `DropdownMenuRadioItem` hold toggles and choices; `DropdownMenuSub` nests a submenu; labels, groups and separators organise long menus.

### Why use Dropdown Menu?

Secondary actions crowd a toolbar or a table row. A menu keeps them one click away, with full keyboard support and a consistent look for destructive items.

### Dropdown Menu features

- **Item types.** Actions, checkboxes, radio groups and submenus.
- **Icons and shortcuts.** `DropdownMenuShortcut` for the key hint.
- **Destructive items.** `variant="destructive"` on an item.
- **Positioning.** `side` and `align` on the content.

## Integrating with other components

Open it from a [Button](/components/button) or an [Avatar](/components/avatar); show [Kbd](/components/kbd) shortcuts and [Badge](/components/badge)s in items; confirm destructive actions with an [Alert Dialog](/components/alert-dialog). [Data Table](/components/data-table) rows use it for their actions.

## Frequently asked questions

### Dropdown menu or combobox?

A menu runs actions or toggles settings; a [Combobox](/components/combobox) picks a value for a field.

### How do I nest actions?

`DropdownMenuSub` with a `DropdownMenuSubTrigger` and `DropdownMenuSubContent`; keep nesting to one level.

### Can items toggle features on and off?

Yes: `DropdownMenuCheckboxItem` with `checked` and `onCheckedChange`.

### How do I show shortcuts?

`DropdownMenuShortcut` inside the item ("⌘D"); bind the shortcut itself separately.

### Is it keyboard-accessible?

Yes: the arrow keys move through items, Enter activates, the right arrow opens a submenu, and Escape closes.
