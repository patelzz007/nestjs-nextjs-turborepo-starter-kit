## When to use

- A one-time code from a text message, an email or an authenticator app
- A short PIN
- A code people may paste or autofill from the keyboard's suggestion

## When not to use

- A password: use [PasswordInput](/showcase/password-input)
- A long code with no fixed length: use [Input](/showcase/input)
- A number stepped up and down: use [NumberField](/showcase/number-field)

## Notes

- One hidden text field draws the slots, so the keyboard's code suggestion and paste fill every slot at once
- `normalize` keeps what the code allows (digits only, letters and digits)

## InputOTP: a one-time code

`InputOTP` takes a code one character per slot, with `onComplete` when every slot is filled.

### What is it?

A row of slots over one text field.

### Why use it?

Slots show how long the code is and where people are in it.

### Features

- **Any length.** `length`.
- **Keyboards.** `number-pad` for digit codes.
- **Shaping.** `normalize` keeps only allowed characters.
- **Sizes and states.** `sm`, `md`, `lg`; invalid, disabled, loading.

## Integrating with other components

Put it in a [Field](/showcase/field) or a [Card](/showcase/card) with a resend [Button](/showcase/button).

## Frequently asked questions

### Does the SMS code fill in by itself?

The keyboard offers it (iOS one-time code, Android SMS retriever) and fills every slot at once.
