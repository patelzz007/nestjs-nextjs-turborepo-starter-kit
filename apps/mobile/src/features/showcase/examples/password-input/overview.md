## When to use

- Any password: sign in, sign up, change password
- A secret people may need to check as they type (an API key)
- A field whose visibility a screen controls (a show-all toggle)

## When not to use

- A one-time code: use [InputOTP](/showcase/input-otp)
- A PIN on a keypad screen
- Text that is not secret

## Notes

- The eye button shows and hides the text; pass `visible` and `onVisibleChange` to own it
- It turns on the platform's password autofill

## PasswordInput: a secret, with a way to check it

`PasswordInput` is an `Input` for secrets: masked, with an eye button that shows the text, and the platform's password autofill.

### What is it?

A masked field with a show / hide button.

### Why use it?

People mistype passwords; letting them check before submitting avoids a failed sign-in.

### Features

- **Show and hide.** The eye button, named for screen readers.
- **Controlled visibility.** `visible` and `onVisibleChange`.
- **Everything Input has.** Sizes and states.

## Integrating with other components

Pair it with [PasswordStrengthMeter](/showcase/password-strength-meter) on sign-up, inside a [Field](/showcase/field).

## Frequently asked questions

### Does it check the password's strength?

No: show [PasswordStrengthMeter](/showcase/password-strength-meter) under it, scored by your rules.
