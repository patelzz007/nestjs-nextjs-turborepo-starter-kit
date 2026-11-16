## When to use

- Labelled text, email and search fields
- Native typed fields for passwords, phones, URLs, numbers, dates, times and files
- Field states and hints: disabled, required or optional marks, errors and character counts

## When not to use

- Icons, buttons, units or a prefix inside the border of the box: use [Input Group](/components/input-group)
- International phone numbers chosen by country and formatted as people type: use [Phone Input](/components/phone-input)
- Several lines of text: use [Textarea](/components/textarea)

## Notes

- The red invalid border comes from `aria-invalid` on `Input`; `FieldError` only prints the message
- `loading` styles the field as busy but does not disable it — set `disabled` too if typing should stop

## Input: text entry for forms

`Input` is the kit's single-line text field, built on Base UI's input. It forwards every native attribute — `type`, `name`, `required`, `autoComplete`, `inputMode` — so the browser's own validation, autofill and mobile keyboards keep working.

### What is Input?

A text box. It comes in three sizes (`sm`, `default`, `lg`) and shares its states with every field in the kit: `aria-invalid` turns its border red, `disabled` dims it, and `loading` marks it busy while something is checked.

### Why use Input?

Most data enters an app through a text field. A shared `Input` keeps the height, focus ring and error styling identical across every form, and pairs with `Field`, `Label` and `InputGroup` without extra CSS.

### Input features

- **Every native type.** Text, email, password, number, tel, url, date, time and file.
- **Three sizes.** `sm`, `default` and `lg`.
- **Shared states.** `aria-invalid`, `disabled` and `loading`, styled like every other field.
- **Form-library ready.** `ref` reaches the native input, so focus-on-error works.

## Integrating with other components

Wrap it in a [Field](/components/field) with a [Label](/components/label), a hint and an error. Use [Input Group](/components/input-group) to add an icon, a prefix or a button inside its border, and [Password Input](/components/password-input) for a show/hide toggle.

## Frequently asked questions

### How do I validate an input?

Validate with your form library (the kit's forms use TanStack Form with Zod), set `aria-invalid` on the input while it is invalid, and show the message in a `FieldError` under it.

### Should I rely on the `type` attribute?

Use it for the right mobile keyboard and autofill (`type="email"`, `inputMode="numeric"`), but always validate on the server and in your schema too: the browser's checks are a convenience, not a guarantee.

### Is it accessible?

It is a native `input`: give it a visible [Label](/components/label) via `htmlFor`, and link hints and errors with `aria-describedby`.

### How do I validate as people type?

Validate on blur first and on change once the field has been touched, so people are not told they are wrong before they finish typing.
