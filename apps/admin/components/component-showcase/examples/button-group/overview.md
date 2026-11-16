## When to use

- Toolbars of related actions joined into one strip, such as editor, media, zoom or export controls
- Split buttons that pair a main action with a chevron menu of its variants, such as Save or Publish
- Segmented pickers and filter bars that join buttons to selects, inputs, counters and status text

## When not to use

- Segmented choices whose pressed option screen readers must hear announced: use [Toggle Group](/components/toggle-group)
- A text field with an icon, a prefix or an action drawn inside its own border: use [Input Group](/components/input-group)
- A single standalone action, or actions spaced apart with no shared border: use [Button](/components/button)

## Notes

- Only children with a `data-slot` join at the seams — every kit part has one; wrap your own markup in `ButtonGroupText`
- `ButtonGroup` sets `role="group"` but no name: pass `aria-label` so screen readers say what the set controls

## Button Group: toolbars, split buttons and segmented controls

`ButtonGroup` joins related controls into one segmented strip: the seams between them lose their inner corners and borders, so several buttons, a select, an input or a text segment read as a single control. It lays out horizontally or, with `orientation="vertical"`, as a column.

### What is Button Group?

A wrapper that styles its direct children as one unit. It does not manage state: each button keeps its own handler, and a select or input inside keeps its own value. `ButtonGroupText` adds a non-interactive segment — a label, a count, a unit — and `ButtonGroupSeparator` draws a divider between segments that should stay visually distinct.

### Why use Button Group?

Joined controls say "these belong together" without a heading. Toolbars, pagination, split buttons with a dropdown and filter bars all read faster as one strip, and nesting groups (a group of groups, with a gap between them) separates clusters inside a long toolbar.

### Button Group features

- **Horizontal or vertical.** `orientation` joins the seams on the right axis.
- **Any kit control.** Buttons, selects, inputs, menus and badges join at the seams through their `data-slot`.
- **Text segments.** `ButtonGroupText` for a label, a counter or a status inside the strip.
- **Separators.** `ButtonGroupSeparator` for a visible divider between segments.
- **Nesting.** A group of groups keeps a gap between clusters.

## Integrating with other components

Put a [Dropdown Menu](/components/dropdown-menu) trigger at the end of a group for a split button, or a [Select](/components/select) beside an [Input](/components/input) for an amount and its currency. A [Badge](/components/badge) or a `ButtonGroupText` count rides inside the strip, and a [Tooltip](/components/tooltip) names each icon-only button.

For a set where exactly one option is pressed, use [Toggle Group](/components/toggle-group) instead: it carries the pressed state that a button group does not.

## Frequently asked questions

### Button Group or Tabs?

Button Group for actions and quick filters; [Tabs](/components/tabs) for switching between views of content. Tabs own a selected panel; a button group owns nothing.

### Can a group hold more than five buttons?

Yes, but watch narrow screens. Past three or four, consider moving the rarer actions into a [Dropdown Menu](/components/dropdown-menu) at the end of the group.

### How do I show which button is selected?

A button group has no selected state. When one option must stay chosen, use [Toggle Group](/components/toggle-group), which marks the pressed item with `aria-pressed` and styles it.

### Is it keyboard accessible?

Each button stays a tab stop of its own, in order. Give the group an `aria-label` so a screen reader announces what the set is for.
