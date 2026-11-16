## Installation

The dropdown menu parts ship with the kit in `packages/ui/src/components/dropdown-menu.tsx`, built on Base UI's menu; there is nothing to install.

```showcase-example
c-dropdown-menu-1
```

## Usage

```tsx
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
```

```tsx
<DropdownMenu>
	<DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Row actions" />}>
		<MoreHorizontal aria-hidden="true" />
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end">
		<DropdownMenuGroup>
			<DropdownMenuLabel>Actions</DropdownMenuLabel>
			<DropdownMenuItem onClick={edit}>
				Edit <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
			</DropdownMenuItem>
		</DropdownMenuGroup>
		<DropdownMenuSeparator />
		<DropdownMenuItem variant="destructive" onClick={remove}>
			Delete
		</DropdownMenuItem>
	</DropdownMenuContent>
</DropdownMenu>
```

## Examples

### Nested submenus

```showcase-example
c-dropdown-menu-5
```

### Checkboxes

```showcase-example
c-dropdown-menu-6
```

### Radio groups

```showcase-example
c-dropdown-menu-7
```

### User profile

```showcase-example
c-dropdown-menu-9
```

### Record actions

```showcase-example
c-dropdown-menu-12
```

## API Reference

```showcase-api

```

## Keyboard

| Key                 | Action                             |
| :------------------ | :--------------------------------- |
| `Enter` `Space` `↓` | Opens the menu from its trigger.   |
| `↑` `↓`             | Moves through the items.           |
| `→` `←`             | Opens or closes a submenu.         |
| `Enter` `Space`     | Activates the item.                |
| A letter            | Jumps to an item starting with it. |
| `Esc`               | Closes the menu.                   |

## Accessibility

- The trigger exposes `aria-expanded`; the menu is `role="menu"` with `menuitem`, `menuitemcheckbox` and `menuitemradio` items.
- Name icon-only triggers with `aria-label`.
