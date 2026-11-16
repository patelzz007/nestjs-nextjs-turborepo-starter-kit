## When to use

- Consent and opt-in fields, such as accepting terms or turning on a feature
- Lists where any number of options can be ticked, like notification channels or permissions
- Selectable cards and tiles for modules, people or a saved payment card

## When not to use

- A choice where exactly one option of a set may be picked: use [Radio Group](/components/radio-group)
- An on/off setting that applies the moment it is flipped: use [Switch](/components/switch)
- A button-shaped on/off control in a toolbar: use [Toggle](/components/toggle)

## Notes

- Give each checkbox a `name` inside a real form, or a native submit sends nothing for it
- The mixed state comes from `indeterminate`, and draws a dash rather than a tick
- Clicking the label toggles the box only when the label is tied to it by `htmlFor` or wraps it

## Checkbox: one choice or many, in forms and lists

`Checkbox` is a box that is ticked, unticked or part-ticked (`indeterminate`), built on Base UI's checkbox. It renders a real button with `role="checkbox"` and a hidden native input, so it works with forms and assistive technology alike.

### What is Checkbox?

The control for independent yes/no choices: agree to the terms, email me updates, grant this permission. A "select all" box above a list uses the indeterminate state to show that only some of the list is ticked.

### Why use Checkbox?

Checkboxes say "pick any of these" at a glance. The kit's version keeps the tick, the dash, the disabled and the invalid looks identical across every form, and pairs with `Field` for a title and a description beside the box.

### Checkbox features

- **Three states.** Checked, unchecked and indeterminate (a dash).
- **Controlled or uncontrolled.** `checked` / `onCheckedChange`, or `defaultChecked`.
- **Sizes.** `sm`, `default` and `lg`.
- **States.** `disabled`, `aria-invalid` and `loading`.
- **Cards and tiles.** Wrap a checkbox and its text in a label to make the whole card clickable.

## Integrating with other components

Lay out a box with its title and description using [Field](/components/field) (`FieldContent`, `FieldTitle`), group boxes under a legend with `FieldSet`, and add a [Tooltip](/components/tooltip) for extra context. For the whole card to be the target, wrap it in a [Label](/components/label).

## Frequently asked questions

### Checkbox, Switch or Radio?

Checkbox for any number of independent choices submitted with a form; [Switch](/components/switch) for a setting that takes effect at once; [Radio Group](/components/radio-group) for exactly one of several.

### How do I handle a group of checkboxes in a form?

Keep an array of the ticked values in the form state, and add or remove a value in each box's `onCheckedChange`. Give each box the same `name` and its own `value` when the form submits natively.

### What is the indeterminate state?

A "some of these" mark, for a parent box whose children are partly ticked. Set `indeterminate` on the parent; clicking it usually ticks or clears all the children.

### Is it accessible without extra ARIA?

Yes, given a label: it has `role="checkbox"` with `aria-checked` (`true`, `false` or `mixed`), and Space toggles it.
