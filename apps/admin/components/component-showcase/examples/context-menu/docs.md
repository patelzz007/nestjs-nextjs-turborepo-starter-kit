## Installation

The context menu parts ship with the kit in `packages/ui/src/components/context-menu.tsx`, built on Base UI's context menu; there is nothing to install.

```showcase-example
c-context-menu-1
```

## Usage

```tsx
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@workspace/ui/components/context-menu";
```

```tsx
<ContextMenu>
	<ContextMenuTrigger className="rounded-lg border p-6">Right-click this file</ContextMenuTrigger>
	<ContextMenuContent>
		<ContextMenuItem onClick={copy}>
			Copy <ContextMenuShortcut>⌘C</ContextMenuShortcut>
		</ContextMenuItem>
		<ContextMenuSeparator />
		<ContextMenuItem variant="destructive" onClick={remove}>
			Delete
		</ContextMenuItem>
	</ContextMenuContent>
</ContextMenu>
```

## Examples

### Nested submenus

```showcase-example
c-context-menu-4
```

### Labels and separators

```showcase-example
c-context-menu-5
```

### Checkbox items

```showcase-example
c-context-menu-6
```

### Destructive actions

```showcase-example
c-context-menu-8
```

## API Reference

```showcase-api

```

## Keyboard

| Key                    | Action                                 |
| :--------------------- | :------------------------------------- |
| `Shift F10` / Menu key | Opens the menu on the focused trigger. |
| `↑` `↓`                | Moves through the items.               |
| `→` `←`                | Opens or closes a submenu.             |
| `Enter` `Space`        | Activates the item.                    |
| `Esc`                  | Closes the menu.                       |

## Accessibility

- The menu is `role="menu"` with typed items, the same as a dropdown menu.
- Context menus are hard to discover: offer every action elsewhere as well.
