## Installation

The navigation menu parts ship with the kit in `packages/ui/src/components/navigation-menu.tsx`, built on Base UI's navigation menu; there is nothing to install.

```showcase-example
c-navigation-menu-1
```

## Usage

```tsx
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";
```

```tsx
<NavigationMenu>
	<NavigationMenuList>
		<NavigationMenuItem>
			<NavigationMenuTrigger>Products</NavigationMenuTrigger>
			<NavigationMenuContent>
				<NavigationMenuLink render={<Link href="/payments" />}>Payments</NavigationMenuLink>
			</NavigationMenuContent>
		</NavigationMenuItem>
		<NavigationMenuItem>
			<NavigationMenuLink render={<Link href="/pricing" />}>Pricing</NavigationMenuLink>
		</NavigationMenuItem>
	</NavigationMenuList>
</NavigationMenu>
```

## Examples

### Grid layout

```showcase-example
c-navigation-menu-2
```

### With icons

```showcase-example
c-navigation-menu-3
```

## API Reference

```showcase-api

```

## Keyboard

| Key                 | Action                           |
| :------------------ | :------------------------------- |
| `←` `→`             | Moves between top-level items.   |
| `Enter` `Space` `↓` | Opens a panel and moves into it. |
| `Esc`               | Closes the panel.                |

## Accessibility

- A `nav` landmark; triggers expose `aria-expanded` and control their panels; links are real anchors.
