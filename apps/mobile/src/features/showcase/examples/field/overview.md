## When to use

- A form control that needs a visible label, a hint or an error message
- A required or optional field, a counter or a link beside its label
- A group of switches or checkboxes under one legend (`FieldSet`)

## When not to use

- A label with no control under it: use the [Label](/showcase/label) text role
- A setting that is a single switch with its own label: use [Switch](/showcase/switch) alone
- Validation itself: the form's zod schema decides, the field only shows its message

## Notes

- A control inside a `Field` takes its label as its name and its hint as its accessibility hint, with no props repeated
- `error` shows one message, `errors` a list; either makes the field invalid
- `required` adds a star and says "required" in the control's name

## Field: the frame of a form control

`Field` lays out a label, its control, a hint and the validation message, and shares the label and state with the control through context. `FieldSet` groups related fields under a legend.

### What is it?

A field is the label row, the control and the messages under it, stacked (or side by side with `orientation="horizontal"`).

### Why use it?

Every form on every screen gets the same spacing, the same error look and the same screen-reader wiring, without repeating a label on the control.

### Features

- **Label row.** `label`, `required`, `optional` and `labelTrailing` (a count, a badge, a link).
- **Messages.** `hint`, `error` and `errors`.
- **State.** `invalid`, `disabled` and `loading` reach the control inside.
- **Layout.** Vertical or horizontal; `FieldSet` for groups.

## Integrating with other components

Put any of the kit's controls inside: [Input](/showcase/input), [InputGroup](/showcase/input-group), [Textarea](/showcase/textarea), [SelectField](/showcase/select), [InputOTP](/showcase/input-otp). Group [Switch](/showcase/switch)es and [Checkbox](/showcase/checkbox)es under a `FieldSet`.

## Frequently asked questions

### Does the field validate?

No. The form (TanStack Form with the shared zod schema) validates and passes the first message as `error`, or every failed rule as `errors`.

### How is the control named?

By the field's `label`, through context: an `Input` in a `Field` needs no `accessibilityLabel`. A control's own props still win.
