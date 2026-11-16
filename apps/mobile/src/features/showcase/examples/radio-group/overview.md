## When to use

- One choice out of a few options, all shown
- A choice saved with a form: a plan, a shipping speed
- Options that need a line of explanation each

## When not to use

- More than about seven options: use [SelectField](/showcase/select)
- Several choices at once: use [Checkbox](/showcase/checkbox)es
- A choice that applies at once in a toolbar: use [ToggleGroup](/showcase/toggle-group)

## Notes

- Generic over the option value; `onChange` reports the chosen one
- Options are data with a label, a description, and optional `leading` and `trailing`

## RadioGroup: one out of a few

`RadioGroup` lists options with a ring each, in a plain or card look, vertical, horizontal or as a two-column grid, the ring at either end, in colour tones.

### What is it?

A set of radios read as one choice.

### Why use it?

Showing every option lets people compare before they choose.

### Features

- **Looks.** Default and card.
- **Layout.** Vertical, horizontal, grid.
- **Rows.** Descriptions, `leading`, `trailing`.
- **States.** Disabled options, a disabled or invalid group.

## Integrating with other components

Put it under a [FieldSet](/showcase/field) legend.

## Frequently asked questions

### Can nothing be chosen?

Yes, until people pick: pass `value={null}`. Once picked, a radio cannot be cleared — use a "None" option if that is a choice.
