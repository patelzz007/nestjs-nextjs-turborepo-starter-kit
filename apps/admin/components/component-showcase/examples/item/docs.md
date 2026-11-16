## Installation

The item parts ship with the kit in `packages/ui/src/components/item.tsx`; there is nothing to install.

```showcase-example
c-item-1
```

## Usage

```tsx
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
```

```tsx
<Item variant="outline">
	<ItemMedia variant="icon">
		<FileText aria-hidden="true" />
	</ItemMedia>
	<ItemContent>
		<ItemTitle>Invoice March.pdf</ItemTitle>
		<ItemDescription>2.4 MB · uploaded today</ItemDescription>
	</ItemContent>
	<ItemActions>
		<Button variant="outline" size="sm">
			Download
		</Button>
	</ItemActions>
</Item>
```

## Examples

### Icon and actions

```showcase-example
c-item-2
```

### Navigation links

```showcase-example
c-item-4
```

### Header and footer

```showcase-example
c-item-10
```

### Activity feed

```showcase-example
c-item-12
```

## API Reference

```showcase-api

```

## Accessibility

- `ItemGroup` is a list: render rows as `li` (or give them `role="listitem"`) so the count is announced.
- A row rendered as a link is one tab stop; keep other actions as separate buttons.
