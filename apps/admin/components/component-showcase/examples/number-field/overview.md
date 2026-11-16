## When to use

- Quantities, amounts and counts stepped up or down by buttons within a min and max
- Compact numeric settings whose label scrubs the value when dragged sideways
- Validated amounts in a form, checked by a Zod schema with the error shown below

## When not to use

- Free text such as a name, an email or an order ID, with nothing to step: use [Input](/components/input)
- A value picked from a continuous range by dragging a handle: use [Slider](/components/slider)
- Money in a fixed currency typed freely: an [Input Group](/components/input-group) with a currency prefix reads better than spin buttons

## Notes

- `onValueChange` receives `null` when the field is cleared, so type a controlled `value` as `number | null`
- Set `aria-invalid` on `NumberFieldGroup` to turn its border destructive; `data-invalid` on `Field` only recolours text
- An outside label must point `htmlFor` at the `id` given to `NumberField`, which Base UI puts on the input

## Number Field: stepped numeric entry

`NumberField` is a numeric input with increment and decrement buttons and an optional scrub area — a label you drag sideways to change the value. It is built on Base UI's number field, so typing, the arrow keys, `min`, `max`, `step` and locale-aware formatting all come from the primitive.

### What is Number Field?

A field for numbers that people adjust as often as they type: quantities, seats, percentages, prices. `NumberFieldGroup` joins the buttons and the input into one control; `NumberFieldScrubArea` turns the label into a drag handle.

### Why use Number Field?

A plain `type="number"` input styles poorly, varies by browser and gives little control over steps and formatting. `NumberField` offers clear buttons, keyboard stepping, bounds that disable the buttons at the limit, and `Intl.NumberFormat` options for currency or percentages.

### Number Field features

- **Steps and bounds.** `step`, `smallStep`, `largeStep`, `min` and `max`; the buttons disable at a bound.
- **Formatting.** `format` takes `Intl.NumberFormat` options — currency, percent, fixed decimals.
- **Scrub to change.** Drag `NumberFieldScrubArea` sideways to step the value.
- **Three sizes.** `sm`, `default` and `lg`, shared by every part through `size`.
- **Layouts.** Buttons on both sides, both on the right, or stacked as spinners.

## Integrating with other components

Wrap it in a [Field](/components/field) with a label and an error; set `aria-invalid` on the group when the schema rejects the value. In a cart line, put it beside the item's price in an [Item](/components/item); in filters, pair two of them for a min and max range.

## Frequently asked questions

### Can it take decimals, such as prices?

Yes. Set `step={0.01}` (or `format={{ minimumFractionDigits: 2 }}`), or `format={{ style: "currency", currency: "MYR" }}` to show the currency as well.

### How do I set a minimum and a maximum?

`min` and `max`. The buttons disable at a bound, and a typed value outside the range is clamped when the field loses focus.

### How is it different from `<input type="number">`?

It adds consistent buttons, keyboard steps, scrubbing, bounds and locale formatting, with the same look in every browser.

### Does it work with a form library?

Yes: treat it as a controlled field — `value` and `onValueChange` from TanStack Form (or any library) — and remember the value can be `null` when cleared.

### Is it accessible?

The input has `role="spinbutton"` with its value, minimum and maximum exposed; the arrow keys step it. Name it with a label tied to its `id`.
