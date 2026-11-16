## When to use

- A single line of text: a name, an email, a URL, a number typed as text
- A field in a form, with a label, a hint and an error from `Field`
- A search box or an inline title with a lighter look (`filled`, `underline`, `ghost`)

## When not to use

- Several lines of text: use [Textarea](/showcase/textarea)
- A field with icons, text or buttons inside it: use [InputGroup](/showcase/input-group)
- A number stepped with buttons: use [NumberField](/showcase/number-field)

## Notes

- Controlled: `value` in, `onChange(text)` out; `normalize` shapes what is typed (digits only) before it is reported
- `keyboardType`, `textContentType` and `autoComplete` pick the keyboard and the autofill
- Fields take the fill of the surface they sit on: page or card

## Input: one line of text

`Input` is the kit's text field: 48 pt tall, with outlined, filled, underline and ghost looks, three sizes, and loading, disabled and invalid states. Inside a `Field` it takes the field's label and state.

### What is it?

A `TextInput` in a token-styled box, with optional content before and after the text.

### Why use it?

One field for every form keeps sizes, focus rings and error states the same everywhere.

### Features

- **Four looks.** `default` (outlined), `filled`, `underline`, `ghost`.
- **Three sizes.** `sm`, `md`, `lg`.
- **States.** Loading, disabled, invalid, read only (`editable={false}`).
- **Keyboards.** Email, phone, URL, number via `keyboardType`.

## Integrating with other components

Wrap it in a [Field](/showcase/field) for its label and messages; add icons or buttons with [InputGroup](/showcase/input-group).

## Frequently asked questions

### Why does my number arrive as text?

An input reports text. Parse it in the form's schema, or use [NumberField](/showcase/number-field), which reports a number.

### How do I show the right keyboard?

Set `keyboardType` (`email-address`, `phone-pad`, `url`, `number-pad`) and `textContentType` / `autoComplete` for autofill.
