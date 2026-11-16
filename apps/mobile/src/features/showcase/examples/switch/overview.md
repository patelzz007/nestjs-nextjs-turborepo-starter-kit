## When to use

- A setting that applies the moment it is flipped: notifications, dark mode
- A list of settings, each on or off
- A setting that is always on by policy (locked)

## When not to use

- A choice saved with a form: use [Checkbox](/showcase/checkbox)
- An option on the content in front of people: use [Toggle](/showcase/toggle)
- More than two states: use [SegmentedControl](/showcase/toggle-group)

## Notes

- On, off, disabled and locked each look different
- Controlled: `checked` in, `onChange(next)` out

## Switch: a setting, on or off

`Switch` is a labelled, token-styled switch whose thumb slides on the selection spring, in two sizes, with a card variant, slots, colour tones and a destructive label.

### What is it?

A track and a thumb beside a label.

### Why use it?

A switch says "this takes effect now".

### Features

- **States.** On, off, disabled (dashed), locked (a lock).
- **Rows.** `description`, `leading`, `trailing`.
- **Looks.** Card variant; tones; the switch at either end.
- **Destructive.** A label in the destructive colour.

## Integrating with other components

List them in a [ListGroup](/showcase/item) or under a [FieldSet](/showcase/field).

## Frequently asked questions

### Why not the system switch?

The kit's switch looks the same in every theme and on both platforms, and shows disabled and locked plainly.
