## When to use

- Short single-choice lists in forms and settings, such as density, visibility, role or release channel
- Option tiles and divided card rows for shipping speed, contact method, language or a teammate
- Checkout and plan steps that pick one saved payment method or one priced subscription tier

## When not to use

- A list where any number of options can be ticked together: use [Checkbox](/components/checkbox)
- A long list of options: use [Select](/components/select) or [Combobox](/components/combobox)
- A compact, button-shaped choice in a toolbar: use [Toggle Group](/components/toggle-group)

## Notes

- Pass a controlled `value` and `onValueChange` to act on the pick; `defaultValue` alone stores it inside the group
- Set `name` on `RadioGroup` when it lives in a form, so a native post carries the choice
- Derive item `id`s with `React.useId()` when a group can render twice on one page

## Radio Group: one choice from a few

`RadioGroup` holds a set of `RadioGroupItem`s of which exactly one can be chosen. It is built on Base UI's radio group, so the arrow keys move the choice and the group is a single tab stop.

### What is Radio Group?

The control for "pick one of these" when all the options should be visible at once — two to about seven of them. Each item is a round radio with its label; whole cards can be the target, for plans or payment methods.

### Why use Radio Group?

Seeing every option side by side helps people compare before choosing, which a dropdown hides. Radio groups also show the current choice without opening anything.

### Radio Group features

- **Controlled or uncontrolled.** `value` / `onValueChange`, or `defaultValue`.
- **Keyboard.** One tab stop; the arrow keys move between options.
- **Sizes.** `sm`, `default` and `lg` on each item.
- **Disabled options.** On an item, or on the whole group.
- **Cards.** Wrap an item and its description in a label to make the card the target.

## Integrating with other components

Title the group with a `FieldSet` and `FieldLegend` from [Field](/components/field), describe options with `FieldDescription`, and add a [Badge](/components/badge) for "Recommended". For plans, put each option in a [Card](/components/card)-like label.

## Frequently asked questions

### Radio group or dropdown?

A radio group when there are few options and comparing them matters; a [Select](/components/select) when the list is long or space is tight.

### How do I make it required?

Validate that a value is set in your schema, and show the error in a `FieldError` under the group; `aria-invalid` on the group styles the radios.

### Can options have descriptions?

Yes: put a `FieldContent` with a title and a description beside each item, as the Descriptions example does.

### Is it keyboard-accessible?

Yes. Tab reaches the checked option (or the first), and the arrow keys move the choice.

### Can I disable some options?

Set `disabled` on those `RadioGroupItem`s; they are skipped by the arrow keys.
