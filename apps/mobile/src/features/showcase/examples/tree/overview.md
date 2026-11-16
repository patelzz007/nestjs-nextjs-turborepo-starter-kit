## When to use

- An outline, a file explorer, an org chart
- Permissions grouped by area, ticked with cascading checkboxes

## When not to use

- Picking one value from a tree in a form: use [Cascader](/showcase/cascader)
- A flat list: use a [ListGroup](/showcase/item)

## Notes

- Branches open and close in place; closed children are not rendered
- Ticking a branch ticks every leaf under it; a partly ticked branch shows a dash
- Deep trees get cramped on a phone: keep them shallow

## Tree: nested items that open in place

`Tree` takes `items` and draws them as rows that open in place, with optional guides, glyphs, a picked row and checkboxes.

### Features

- **Toggles.** A chevron or a plus and minus.
- **Guides.** Lines down each indent level.
- **Glyphs.** Per row, changing when a branch opens, in any colour.
- **People.** A leading avatar and a second line.
- **Checkboxes.** Cascading ticks with a mixed state.
- **Indent.** 24 or 32 pt a level.

## Integrating with other components

Rows lead with an [Avatar](/showcase/avatar); for a picker, the [Cascader](/showcase/cascader) shares the same tree logic.

## Frequently asked questions

### Can I control which branches are open?

Yes: pass `expanded` and `onExpandedChange`, or `defaultExpanded` to let the tree keep them.
