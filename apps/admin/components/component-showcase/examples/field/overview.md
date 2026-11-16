## When to use

- Labelled inputs, selects, text areas and code entry, with an optional hint under the control
- Preference and permission lists where every switch or checkbox has a title and a description
- Validation states with a red label and one error — or a list of them — under the control

## When not to use

- A single control with only a name: a [Label](/components/label) tied to it by `htmlFor` is enough
- A numeric value stepped with plus and minus buttons or scrubbed by dragging: use [Number Field](/components/number-field)
- A whole create or edit page: compose fields inside a form, with one save action at the end

## Notes

- `FieldTitle` is a plain `div`, so a checkbox or switch titled only by it has no accessible name: point a `FieldLabel` at its `id` instead
- `data-invalid` on `Field` tints its text; the control's own red border comes from `aria-invalid` on the control, so set both
- Nothing ties `FieldDescription` or `FieldError` to the control on its own: give them ids and list them in the control's `aria-describedby`

## Field: form layout, labels, hints and errors

`Field` is the kit's layout for one form control: a label, the control, a hint and an error, stacked (`vertical`), side by side (`horizontal`), or side by side only from a medium container width up (`responsive`). `FieldSet`, `FieldLegend` and `FieldGroup` collect related fields into sections, and `FieldSeparator` divides them.

### What is Field?

A set of small layout parts that give every form the same rhythm. `Field` itself is a `role="group"` wrapper; `FieldLabel` is the kit's `Label`; `FieldContent` groups a title and a description beside a checkbox or switch; `FieldDescription` is the hint; `FieldError` shows one error or a de-duplicated list of them.

### Why use Field?

Forms drift when every screen spaces its labels and errors by hand. `Field` fixes the spacing, the error styling and the responsive layout once, and works with any control — Input, Select, Checkbox, Switch, Slider, Input OTP — and any form library.

### Field features

- **Three orientations.** `vertical`, `horizontal`, and `responsive`, which switches on the field group's container width.
- **Errors from a form library.** `FieldError errors={field.state.meta.errors}` renders one message or a list, de-duplicated, with `role="alert"`.
- **Sections.** `FieldSet` and `FieldLegend` for a titled group; `FieldGroup` for spacing; `FieldSeparator` to divide, optionally with text.
- **Choice rows.** `FieldContent` and `FieldTitle` lay out a checkbox or switch beside its title and description.

## Integrating with other components

Wrap any control: [Input](/components/input), [Textarea](/components/textarea), [Select](/components/select), [Checkbox](/components/checkbox), [Switch](/components/switch), [Slider](/components/slider), [Input OTP](/components/input-otp). With TanStack Form, pass the field's errors to `FieldError` and set `aria-invalid` on the control when the field is invalid.

## Frequently asked questions

### What goes inside a Field?

One control and what describes it: a `FieldLabel`, the control, an optional `FieldDescription` and a `FieldError`. Put a `FieldContent` around the title and description when the control sits beside them, as checkbox and switch rows do.

### How do I show validation errors?

Render `FieldError` under the control, with `errors` from your form library or a message as children. Set `data-invalid` on the `Field` (it tints the label) and `aria-invalid` on the control (it turns its border red).

### Does it work with TanStack Form or React Hook Form?

Yes. `Field` holds no state: wire the control's value and handlers as the library asks, and pass the field's errors to `FieldError`.

### How do I lay fields out side by side?

`orientation="horizontal"` puts the label beside the control; `orientation="responsive"` does so only once the surrounding `FieldGroup` is wide enough, and stacks them on narrow screens.

### FieldDescription or FieldError?

`FieldDescription` is a hint that is always there; `FieldError` appears only while the field is invalid and is announced as an alert.

### Is it accessible without extra ARIA?

The label is tied to its control by `htmlFor`. Hints and errors are not linked automatically: give them ids and add them to the control's `aria-describedby`, so screen readers read them with the field.
