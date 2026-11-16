## When to use

- One choice out of a few that applies at once, such as a view, a period or an alignment
- Several independent options in one control, such as text styles or notification channels
- A segmented control: the options joined into one shape

## When not to use

- A long list of options: use [SelectField](/showcase/select)
- Actions rather than choices: use [ButtonGroup](/showcase/button-group)
- A choice inside a form that is saved with it: use [RadioGroup](/showcase/radio-group)

## Notes

- `type="single"` is a radio group (one value or `null`); `type="multiple"` a group of checkboxes (an array)
- Options are data: each has a `value`, a `label` and, optionally, an `icon` and a `badge`

## ToggleGroup: picking from a few

`ToggleGroup` lays out toggle chips read as one choice. Generic over the option value and controlled, it reports the new value from `onChange`. `spacing="attached"` joins the chips into a segmented control and `orientation="vertical"` stacks them.

### What is it?

A set of toggles that share one value: picking one (or several) updates the group's value.

### Why use it?

Few options shown at once are faster to pick than a menu, and the picked one stays visible.

### Features

- **Single or multiple.** `type` picks one or any number.
- **Joined or separated.** `spacing`.
- **Horizontal or vertical.** `orientation`.
- **Icon-only.** `hideLabels`, each option still named.
- **Badges.** An option's `badge` ("Save 20%").

## Integrating with other components

Each chip is drawn with [Toggle](/showcase/toggle)'s variants. For actions, use [ButtonGroup](/showcase/button-group); for a choice in a form, [RadioGroup](/showcase/radio-group).

## Frequently asked questions

### Can nothing be picked?

With `type="single"`, pass `deselectable` to let a second press clear the choice (`null`). A multiple group can always be empty.

### How is it read out?

A single group is a radio group of radios, a multiple group a group of checkboxes, named by the group's `label`.
