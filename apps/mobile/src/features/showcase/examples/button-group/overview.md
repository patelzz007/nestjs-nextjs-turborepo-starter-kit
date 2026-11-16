## When to use

- Several related actions that read as one control, such as a split save or a pager
- A button joined to a field, a count or a menu, such as search with a scope or a like with its tally
- A short set of exclusive choices drawn as joined buttons, such as an order type or an interval

## When not to use

- One choice that stays picked out of a set of options with no actions: use [ToggleGroup](/showcase/toggle-group)
- Unrelated actions that only happen to sit side by side: space them as separate [Button](/showcase/button)s
- Moving between the pages of a long list with numbers and ellipses: use [Pagination](/showcase/pagination)

## Notes

- The group lays its children out and joins their edges; each child keeps its own label, press and state
- Inner corners are squared and doubled borders dropped by the group, so a child's own `className` still wins
- Give the group an `accessibilityLabel` that says what its buttons do together

## ButtonGroup: joined actions on a phone

`ButtonGroup` lays the kit's buttons out as one control — side by side or stacked, either attached (shared edges, inner corners squared) or spaced apart. It is composition only: buttons, icon buttons, inputs, menus, a text cell (`ButtonGroupText`) and a separator (`ButtonGroupSeparator`) go in as children and keep their own behaviour.

### What is it?

A button group is a row (or a column) of related controls drawn as one. The group adds only layout: the edges where two children meet, and the gap between separated ones.

### Why use it?

Joining related actions shows they belong together, and saves the room a gap between every button would take on a narrow screen. A split button (an action and its menu), a pager, a zoom stepper and a field with its button all read faster as one shape.

### Features

- **Attached or separated.** `variant="attached"` joins the children; `separated` spaces them.
- **Horizontal or vertical.** `orientation` stacks a tool palette or a list of sections.
- **Mixed children.** Buttons, icon buttons, inputs, input groups and dropdown menus join the same way.
- **Text cells.** `ButtonGroupText` shows a count or a readout joined to the buttons.
- **Separators.** `ButtonGroupSeparator` draws the line between solid buttons.

## Integrating with other components

A split button is a `Button` joined to a [DropdownMenu](/showcase/dropdown-menu) whose trigger is icon-only. A field with an action is an [Input](/showcase/input) or an [InputGroup](/showcase/input-group) joined to a [Button](/showcase/button). For one picked option out of a few, prefer [ToggleGroup](/showcase/toggle-group), which reports the choice for you.

## Frequently asked questions

### When should I use attached rather than separated?

Attach children that act on the same thing (a split save, a stepper, a pager). Separate a group of related but independent actions — a toolbar's Filter, Export and More — so each reads on its own.

### How do I make a split button?

Join a `Button` and a `DropdownMenu` with `size="icon"` and a chevron glyph; between solid halves add a `ButtonGroupSeparator` with `tone="primary"`. The menu's `label` is its accessible name ("More save options").

### Can a group hold a text field?

Yes: an `Input` or an `InputGroup` with `className="flex-1"` takes the room the buttons leave, and the group squares its inner corners like a button's.

### How do screen readers read a group?

As a group named by its `accessibilityLabel`, then each child by its own name. A `ButtonGroupText` is read as text; a count that belongs to a button is better said in that button's `accessibilityLabel` ("Like, 1.2K likes").
