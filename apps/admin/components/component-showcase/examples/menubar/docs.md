## Installation

The menubar parts ship with the kit in `packages/ui/src/components/menubar.tsx`, built on Base UI's menubar and menu; there is nothing to install.

```showcase-example
c-menubar-1
```

## Usage

```tsx
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from "@workspace/ui/components/menubar";
```

```tsx
<Menubar>
	<MenubarMenu>
		<MenubarTrigger>File</MenubarTrigger>
		<MenubarContent>
			<MenubarItem onClick={newFile}>
				New file <MenubarShortcut>⌘N</MenubarShortcut>
			</MenubarItem>
			<MenubarSeparator />
			<MenubarItem onClick={print}>Print…</MenubarItem>
		</MenubarContent>
	</MenubarMenu>
</Menubar>
```

## Examples

### Submenus

```showcase-example
c-menubar-2
```

### Checkbox and radio

```showcase-example
c-menubar-3
```

### Formatting and media

```showcase-example
c-menubar-5
```

## API Reference

```showcase-api

```

## Keyboard

| Key                 | Action               |
| :------------------ | :------------------- |
| `←` `→`             | Moves between menus. |
| `Enter` `Space` `↓` | Opens a menu.        |
| `↑` `↓`             | Moves through items. |
| `Esc`               | Closes the menu.     |

## Accessibility

- `role="menubar"` holding `menu`s with typed items; triggers expose `aria-expanded`.
