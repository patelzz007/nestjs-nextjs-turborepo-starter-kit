## When to use

- A number people type or nudge: a quantity, a seat count, a price
- A value with bounds and a step (0–10, by 5)
- A stepper where the exact number matters more than dragging

## When not to use

- A number picked roughly along a range: use [Slider](/showcase/slider)
- A code or an ID that only looks like a number: use [Input](/showcase/input)
- A rating: use [Rating](/showcase/rating)

## Notes

- It reports a number (or `null` when empty), clamped to `min`…`max` and snapped to `step` when the field is left
- Screen readers can step it with a swipe, like the buttons

## NumberField: a number, typed or stepped

`NumberField` is a numeric field with minus and plus buttons, in three layouts (split, end, spinner) and three sizes.

### What is it?

A field for a number with steppers.

### Why use it?

Typing is fastest for a known number; steppers are easiest for a small change.

### Features

- **Bounds and step.** `min`, `max`, `step`.
- **Layouts.** `split`, `end`, `spinner`.
- **Formatting.** `formatValue` writes a unit or a currency.
- **Adjustable.** Screen readers step it.

## Integrating with other components

Put it in a [Field](/showcase/field) for a label and an error.

## Frequently asked questions

### What does it report while typing?

Nothing: the typed text is read when the field is left, clamped and stepped, so a half-typed number never reaches the form.
