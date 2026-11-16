## Installation

`Kanban` ships with the kit in `packages/ui-native/src/components/kanban.tsx`; there is nothing to install.

```showcase-example
c-kanban-1
```

## Usage

```tsx
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle } from "@workspace/ui-native/components/kanban";
```

```tsx
<Kanban value={columns} onValueChange={setColumns} getItemValue={(task) => task.id}>
	<KanbanBoard>
		{Object.entries(columns).map(([column, tasks]) => (
			<KanbanColumn key={column} value={column} label={titles[column]}>
				<KanbanColumnContent>
					{tasks.map((task) => (
						<KanbanItem key={task.id} value={task.id} label={task.title}>
							<KanbanItemHandle>{grip}</KanbanItemHandle>
						</KanbanItem>
					))}
				</KanbanColumnContent>
			</KanbanColumn>
		))}
	</KanbanBoard>
</Kanban>
```

## Moving columns

```showcase-example
c-kanban-2
```

## In frames

```showcase-example
c-kanban-3
```

```showcase-example
c-kanban-4
```

## Roadmap

```showcase-example
c-kanban-5
```

## Saving moves

```showcase-example
c-kanban-6
```

## API Reference

```showcase-api

```

## Accessibility

- Every handle has move actions; moves are announced with the card's and column's names.
- Handles keep a 44 pt touch area, or the grip's own on a dense card.
