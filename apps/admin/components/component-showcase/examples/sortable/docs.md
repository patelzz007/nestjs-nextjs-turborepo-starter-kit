## Installation

The sortable parts ship with the kit in `packages/ui/src/components/sortable.tsx`, built on `@dnd-kit`, already installed. Its announcements come from the `sortable` labels.

```showcase-example
c-sortable-1
```

## Usage

```tsx
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui/components/sortable";
```

```tsx
<Sortable value={items} onValueChange={setItems} getItemValue={(item) => item.id}>
	{items.map((item) => (
		<SortableItem key={item.id} value={item.id}>
			<SortableItemHandle aria-label={`Move ${item.title}`}>
				<GripVertical aria-hidden="true" />
			</SortableItemHandle>
			{item.title}
		</SortableItem>
	))}
</Sortable>
```

## Persisting order

Sortable commits once, on drop, so `onValueChange` alone is enough to persist the whole array. For index-based mutations and a one-line rollback, use `onValueCommit`: it fires with the reordered array and the previous one.

```showcase-example
c-sortable-8
```

## Examples

### Grid layout

```showcase-example
c-sortable-2
```

### Nested layout

```showcase-example
c-sortable-3
```

### Image gallery

```showcase-example
c-sortable-7
```

## API Reference

```showcase-api

```

## Keyboard

| Key             | Action                           |
| :-------------- | :------------------------------- |
| `Space` `Enter` | Lifts or drops the focused item. |
| `↑` `↓` `←` `→` | Moves the lifted item.           |
| `Esc`           | Cancels the move.                |

## Accessibility

- Grips are focusable buttons; name each one for its item.
- Every lift, move, drop and cancel is announced through a live region.
