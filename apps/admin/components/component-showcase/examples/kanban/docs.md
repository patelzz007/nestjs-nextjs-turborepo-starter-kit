## Installation

The kanban parts ship with the kit in `packages/ui/src/components/kanban.tsx`, built on `@dnd-kit`, already installed.

```showcase-example
c-kanban-1
```

## Usage

```tsx
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanColumnHandle, KanbanItem, KanbanItemHandle, KanbanOverlay } from "@workspace/ui/components/kanban";
```

```tsx
<Kanban value={columns} onValueChange={setColumns} onValueCommit={saveMove} getItemValue={(item) => item.id}>
	<KanbanBoard>
		{Object.entries(columns).map(([columnId, items]) => (
			<KanbanColumn key={columnId} value={columnId}>
				<div className="flex items-center justify-between">
					<h3>{columnId}</h3>
					<KanbanColumnHandle aria-label={`Move ${columnId}`}>
						<GripVertical aria-hidden="true" />
					</KanbanColumnHandle>
				</div>
				<KanbanColumnContent value={columnId}>
					{items.map((item) => (
						<KanbanItem key={item.id} value={item.id}>
							<KanbanItemHandle>{item.title}</KanbanItemHandle>
						</KanbanItem>
					))}
				</KanbanColumnContent>
			</KanbanColumn>
		))}
	</KanbanBoard>
	<KanbanOverlay>{/* the dragged card */}</KanbanOverlay>
</Kanban>
```

## Examples

### Dynamic overlay

```showcase-example
c-kanban-2
```

### Frame columns

```showcase-example
c-kanban-3
```

### Feature roadmap

```showcase-example
c-kanban-5
```

### Persisted moves

```showcase-example
c-kanban-6
```

## API Reference

```showcase-api

```

## Keyboard

| Key             | Action                                           |
| :-------------- | :----------------------------------------------- |
| `Space` `Enter` | Lifts or drops the focused card or column.       |
| `↑` `↓` `←` `→` | Moves the lifted card within and across columns. |
| `Esc`           | Cancels the move.                                |

## Accessibility

- Handles are focusable and named; each lift, move and drop is announced.
