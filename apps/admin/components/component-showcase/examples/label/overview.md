## When to use

- Visible names for text inputs, text areas and checkboxes, each tied to its control by id
- Marks beside a field's name: required or optional, a status badge or dot, an info tooltip or an edit toggle
- Field states and hints around the name: disabled, invalid, helper text under it and a live character count

## When not to use

- Form rows that need hint and error slots, grouped sets or a side-by-side layout: use [Field](/components/field)
- The text box itself, for email, password, number or file entry: use [Input](/components/input)
- Lists of tick boxes, a mixed state or selectable cards: use [Checkbox](/components/checkbox)

## Notes

- Every `htmlFor` must match its control's `id`; use `React.useId()` when a field can render more than once
- Placeholder text is not a label: it disappears as people type and many screen readers skip it

## Label: accessible names for form controls

`Label` renders the native `label` element with the kit's typography. Tied to a control by `htmlFor`, it names the control for assistive technology and makes the text a click target that focuses (or toggles) it.

### What is Label?

The visible name of a form control. It dims itself when its control or field is disabled, and it can carry extras — a required asterisk, an "Optional" badge, an info tooltip — without breaking the association.

### Why use Label?

Every control needs a name, and a visible one helps everyone, not only screen-reader users. A clickable label also gives small controls such as checkboxes a much larger target.

### Label features

- **Native association.** `htmlFor` links it to the control's `id`.
- **Disabled styling.** It dims inside a disabled field or beside a disabled peer.
- **Room for extras.** Badges, dots, tooltips and counters sit inline with the text.

## Integrating with other components

Pair it with [Input](/components/input), [Textarea](/components/textarea), [Checkbox](/components/checkbox), [Switch](/components/switch) and [Radio Group](/components/radio-group). Inside a [Field](/components/field), use `FieldLabel`, which is the same component styled for the field layout. An info icon can open a [Tooltip](/components/tooltip) with more context.

## Frequently asked questions

### Label or placeholder?

A label. Placeholders vanish while typing and are not announced reliably; use them for an example value at most.

### How do I tie a label to its control?

Give the control an `id` and the label `htmlFor` with the same value. `React.useId()` keeps ids unique when the form renders more than once.

### Should I mark required or optional fields?

Mark whichever is rarer. If most fields are required, label the few optional ones; otherwise mark the required ones — and set `required` on the control too, so it is enforced and announced.

### Does it work with checkboxes and radios?

Yes. Put the label after the control and tie it by `htmlFor`; clicking the text toggles the control.
