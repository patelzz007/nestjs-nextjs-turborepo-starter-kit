## When to use

- A list the person orders by hand: a playlist, priorities, a navigation menu, an outline
- A grid of cards or images in a chosen order

## When not to use

- An order the app decides (by date, by name): sort it, and offer a sort choice instead
- Moving items between groups: use Kanban

## Notes

- Drag a handle, or use a screen reader's actions (move up, down, to the start, to the end); every move is announced
- The order is the caller's: `onValueChange` hears every move, `onValueCommit` the same for a save

## Sortable

`Sortable` lets the person reorder a list or a grid: drag an item by its handle onto another's place, or move it with a screen reader's actions.

### Features

- **Strategies** `vertical`, `horizontal`, `grid`.
- **Labels** for each item's handle and announcements.
- **Nested** sortables (groups and their values).
- **onValueCommit** with where the item came from and went.

## Integrating with other components

Put rows, cards or Frame panels inside items; save the order with a promise Toast and put it back on failure.

## Frequently asked questions

### How does someone using a screen reader reorder?

Each handle is adjustable, with move up, move down, to the start and to the end; the new position is announced.
