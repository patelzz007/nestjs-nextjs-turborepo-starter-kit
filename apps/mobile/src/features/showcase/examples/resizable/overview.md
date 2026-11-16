## When to use

- A sidebar beside content, an editor beside a preview
- Tablet layouts where people choose how much room each pane gets

## When not to use

- A phone screen's single column: there is no room to share
- Fixed layouts: use flex

## Notes

- Each handle trades size between the two panels beside it, never below their minimums
- For screen readers a handle is adjustable in steps of 5
- Groups nest: a panel can hold another group

## ResizableGroup: panels you resize

`ResizableGroup` lays out `ResizablePanel`s with a handle between each pair.

### Features

- **Direction.** Side by side or stacked.
- **Handles.** A line, a grip, or a pill that grows while dragged.
- **Sizes.** Controlled or not; `onSizesChange` reports every move.
- **Minimums.** Per panel.

## Integrating with other components

Panels hold anything, including another group.

## Frequently asked questions

### How do I keep the sizes?

Pass `sizes` and `onSizesChange`, and store them.
