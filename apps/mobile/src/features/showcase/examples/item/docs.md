## Installation

`Item` ships with the kit in `packages/ui-native/src/components/item.tsx`; there is nothing to install.

```showcase-example
c-item-1
```

## Usage

```tsx
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
```

```tsx
<Item variant="outline">
	<ItemContent>
		<ItemTitle>{title}</ItemTitle>
		<ItemDescription>{detail}</ItemDescription>
	</ItemContent>
</Item>
```

## Media and actions

```showcase-example
c-item-2
```

```showcase-example
c-item-3
```

```showcase-example
c-item-6
```

## Links and commands

```showcase-example
c-item-4
```

```showcase-example
c-item-7
```

## Header and footer

```showcase-example
c-item-10
```

## API Reference

```showcase-api

```

## Accessibility

- Media is hidden from screen readers.
- A pressable row is one named link or button.
