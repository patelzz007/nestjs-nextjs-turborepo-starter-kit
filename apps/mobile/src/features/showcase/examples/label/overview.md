## When to use

- The visible name of a form control, in the kit's label type role
- A label row with extras: a required star, an optional note, a badge, a counter, a tooltip
- A short caption beside a status or a value

## When not to use

- A heading for a section: use the `Subheading` text role
- Running text: use `BodyText` or `MutedText`
- A label tied to a control in a form: prefer [Field](/showcase/field), which names the control for you

## Notes

- `Label` is a text role (`packages/ui-native/src/components/text.tsx`), Geist Medium at the label size
- Inside a `Field` use its `label` prop: the field links the label to the control

## Label: the name of a control

`Label` is the kit's label text role. Most forms set it through `Field`'s `label`, which also names the control for screen readers; on its own it captions a status, a toggle or a custom control.

### What is it?

Text in the label role: 13 pt, medium weight, in the foreground colour.

### Why use it?

One role for every control's name keeps forms consistent, and keeps labels readable at the system text size.

### Features

- **Text role.** One size and weight for every label.
- **Through Field.** `required`, `optional` and `labelTrailing` add the extras.
- **Merges classes.** A caller can add layout or a colour token.

## Integrating with other components

Use it through [Field](/showcase/field) in forms; a [Checkbox](/showcase/checkbox) or a [Switch](/showcase/switch) draws its own label.

## Frequently asked questions

### Label or Field?

Inside a form, `Field`: it ties the label to the control. `Label` alone is for a caption that names something that is not a form control, or a custom layout.

### How do I mark a field required?

Pass `required` to the `Field`: it adds the star and says "required" in the control's name.
