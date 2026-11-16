## When to use

- Ranked lists such as a play queue, notification channels or release tasks, put in order by a grip
- Tile grids such as a media library, where cards change places across rows and columns
- Grouped options and menus reordered in place, such as product variants or sidebar entries

## When not to use

- Cards that move between several status columns: use [Kanban](/components/kanban)
- Table rows reordered among many columns: use [Data Table](/components/data-table) with `draggable`

## Notes

- Drag listeners sit on `SortableItemHandle` only: an item without one cannot be dragged
- `onMove` takes over the reorder, so neither `onValueChange` nor `onValueCommit` fires on drop
- Sortable commits once, on drop: `onValueChange` alone is enough to persist; `onValueCommit` adds the previous value for a rollback

## Sortable: reorder by drag and keyboard

`Sortable` makes a list or a grid reorderable, built on dnd kit. Items move with a pointer, a finger or the keyboard, with a drag overlay and screen-reader announcements; the new order arrives once, on drop.

### What is Sortable?

A root that holds the array (`value`, `onValueChange`, `getItemValue`), `SortableItem`s with a `SortableItemHandle` (the grip), and an optional `SortableOverlay` for the dragged preview.

### Why use Sortable?

Ordering by drag is natural for queues, priorities and galleries. Doing it accessibly — keyboard moves, announcements, autoscroll — is the hard part, and the kit does it once.

### Sortable features

- **Lists and grids.** Vertical, horizontal or grid layouts.
- **Keyboard.** Space to lift, arrows to move, Space to drop, Escape to cancel.
- **Announcements.** Localised screen-reader messages for every step.
- **Commit once.** `onValueChange` on drop; `onValueCommit` with the previous value.
- **Nested.** Sortables inside sortables, as the Nested Layout example shows.

## Integrating with other components

Reorder [Item](/components/item) rows, image tiles from [File Upload](/components/file-upload), or [Sidebar](/components/sidebar) entries; persist the order with a mutation and roll back from `onValueCommit` on failure.

## Frequently asked questions

### How do I save the new order?

Save the array from `onValueChange` (it fires once, on drop), or use `onValueCommit`, which also gives the previous order for a rollback.

### Can people reorder with the keyboard?

Yes: focus a grip, press Space to lift, the arrow keys to move, Space to drop, Escape to cancel.

### Is it accessible?

Yes: grips are buttons named for their item, and each lift, move and drop is announced.
