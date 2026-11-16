## When to use

- Work that moves through stages: tasks across To Do, In Progress, Done
- A roadmap or pipeline the person rearranges by hand

## When not to use

- A single ordered list: use Sortable
- Stages the app decides (a status from the server): show it, with a Select to change it

## Notes

- Drag a card or a column by its handle, or use a screen reader's actions (move up, down, to a column; columns left and right); every move is announced
- The board is the caller's: `onValueChange` hears every move, `onValueCommit` the same with what moved, for a save
- The board scrolls sideways on a phone: keep columns narrow and drag by grips

## Kanban

`Kanban` lays out columns of cards the person rearranges: drag a card within a column or to another, drag columns to reorder them, or move either with a screen reader's actions.

### Features

- **Cards and columns** both movable, each by its own handle.
- **Drop outline** on the card or column a drag will land on.
- **Labels** for every handle, move action and announcement.
- **onValueCommit** with the move (kind, id, target), for an optimistic save.
- **Move rules shared** with the web kit (`@workspace/shared`).

## Integrating with other components

Put Cards or Frame panels inside items, Badges and Avatars on them, a Progress bar for how far along; save a move with a promise Toast and restore the board if it fails.

## Frequently asked questions

### How does someone using a screen reader move a card?

Each card's handle has actions: move up, move down and move to each other column; a column's handle moves it left or right. The result is announced.

### Why does the board scroll instead of dragging?

Only handles start a drag, so a swipe elsewhere scrolls the board. Make the grip the handle, not the whole card.
