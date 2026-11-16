## When to use

- Boards that move cards between status columns by drag and drop
- Roadmap and workflow views where each column is one stage of the work

## When not to use

- A single flat list reordered by drag: use [Sortable](/components/sortable)
- A timeline of tasks with dates and dependencies: use [Gantt](/components/gantt)

## Notes

- Save moves in `onValueCommit`, which fires once per drop with the previous value for a rollback; `onValueChange` also fires mid-drag
- Drag listeners live on `KanbanItemHandle` and `KanbanColumnHandle`: a card or a column without one cannot be dragged
- `KanbanColumnHandle` hides until its column is hovered or the handle has focus, so keep the column's title outside it

## Kanban: cards across columns

`Kanban` arranges cards in columns and moves them by drag and drop — within a column, across columns, or whole columns — built on dnd kit with keyboard support and announcements.

### What is Kanban?

A board: `KanbanBoard` of `KanbanColumn`s, each with a `KanbanColumnContent` of `KanbanItem`s. The value is a record of column ids to their items; `KanbanOverlay` renders the dragged card.

### Why use Kanban?

Status workflows — to do, doing, done — read naturally as columns, and moving a card is the most direct way to change its status.

### Kanban features

- **Cards and columns.** Move cards between columns and reorder columns.
- **Keyboard.** Lift, move and drop with the keyboard.
- **Commit once.** `onValueCommit` per drop with a rollback snapshot.
- **Overlays.** A placeholder or a live preview while dragging.

## Integrating with other components

Render cards as [Card](/components/card)s with [Badge](/components/badge)s and [Avatar](/components/avatar)s, wrap columns in [Frame](/components/frame) panels, and save moves with a mutation. The app's kanban board is built from it.

## Frequently asked questions

### How do I save a move?

In `onValueCommit`: send the move to the server, and restore `previousValue` if it fails.

### Can columns be reordered?

Yes: give each column a `KanbanColumnHandle`.

### Is it accessible?

Yes: handles are focusable, the keyboard lifts and moves cards, and each move is announced.
