## When to use

- A yes / no choice saved with a form (accept the terms)
- Several independent options from a list, any number of them
- A parent that checks a group of children, with a mixed state

## When not to use

- A setting that applies at once: use [Switch](/showcase/switch)
- One choice out of several: use [RadioGroup](/showcase/radio-group)
- An option on the content in front of people (bold): use [Toggle](/showcase/toggle)

## Notes

- Controlled: `checked` in, `onChange(next)` out
- `indeterminate` shows a dash ("mixed"); pressing it checks
- `locked` keeps a choice a policy makes, with a lock, never faded

## Checkbox: one choice, on or off

`Checkbox` is a labelled box with checked, part-checked, unchecked and locked states, in two sizes, with a card variant, a round shape, colour tones, slots before and after the label, and the box at either end.

### What is it?

A box and its label in one pressable row.

### Why use it?

A whole row to tap is easier than a small box, and every state reads differently.

### Features

- **States.** Checked, mixed, unchecked, locked, disabled, invalid.
- **Looks.** Default and card; square or round; tones.
- **Slots.** `leading`, `trailing`, `description`.
- **Layout.** Box at the start or the end.

## Integrating with other components

Group them under a [FieldSet](/showcase/field); put one in a [Card](/showcase/card) for a setting tile.

## Frequently asked questions

### Checkbox or Switch?

A checkbox is saved with a form; a [Switch](/showcase/switch) acts at once.

### How do I make a select-all?

Check it when every child is checked, mark it `indeterminate` when some are, and check or clear every child from its `onChange`.
