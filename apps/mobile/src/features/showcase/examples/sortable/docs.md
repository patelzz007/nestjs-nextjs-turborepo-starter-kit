## Installation

`Sortable` ships with the kit in `packages/ui-native/src/components/sortable.tsx`; there is nothing to install.

```showcase-example
c-sortable-1
```

## Usage

```tsx
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
```

```tsx
<Sortable value={items} onValueChange={setItems} getItemValue={(item) => item.id}>
	{items.map((item) => (
		<SortableItem key={item.id} value={item.id} label={item.title}>
			<SortableItemHandle>{grip}</SortableItemHandle>
		</SortableItem>
	))}
</Sortable>
```

## Grids

```showcase-example
c-sortable-2
```

```showcase-example
c-sortable-7
```

## Nested

```showcase-example
c-sortable-3
```

## In a frame

```showcase-example
c-sortable-4
```

```showcase-example
c-sortable-5
```

```showcase-example
c-sortable-6
```

## Saving the order

```showcase-example
c-sortable-8
```

## API Reference

```showcase-api

```

## Accessibility

- Each handle is adjustable, with move actions; moves are announced.
- The handle keeps a 44 pt touch area.
