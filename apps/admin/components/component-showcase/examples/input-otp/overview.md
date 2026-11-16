## When to use

- Sign-in and email-verification codes, typed or pasted one character per slot
- Numeric PINs and digit-only codes that ignore any letter typed into them
- Fixed-length codes of letters and numbers, split into groups by separators

## When not to use

- A phone number entered before a code is sent: use [Phone Input](/components/phone-input)
- Text of any length, such as a name or a password: use [Input](/components/input) or [Password Input](/components/password-input)

## Notes

- A wrong code turns red only from `aria-invalid` on each `InputOTPSlot`
- Read the code from `onChange` and check it once it reaches `maxLength` (or use `onComplete`)
- `pattern` limits what can be typed: `REGEXP_ONLY_DIGITS` from `input-otp` for a numeric PIN

## Input OTP: one-time codes and PINs

`InputOTP` is a code field split into slots, built on the `input-otp` library. Underneath there is one real input, so typing, pasting a whole code, deleting and the phone's SMS autofill all work as they would in a plain field; the slots only draw the characters.

### What is Input OTP?

The six-digit box from every verification screen. `InputOTPGroup` holds slots, `InputOTPSlot` draws one character with a caret, and `InputOTPSeparator` splits long codes into readable groups.

### Why use Input OTP?

Codes are short-lived and typed under pressure. Separate slots make the length obvious, a whole-code paste fills every slot at once, and the single hidden input keeps autofill (`autoComplete="one-time-code"`) working on iOS and Android.

### Input OTP features

- **Any length.** `maxLength` sets the number of slots.
- **Patterns.** Digits only, letters and digits, or any regular expression.
- **Paste and autofill.** A pasted code fills every slot; SMS codes autofill on mobile.
- **Groups and separators.** Split a long code into readable chunks.

## Integrating with other components

Put it in a [Field](/components/field) with a label, under a [Card](/components/card) header that says where the code was sent, beside a [Button](/components/button) to resend it.

## Frequently asked questions

### Which library does it use?

[`input-otp`](https://input-otp.rodz.dev), wrapped in the kit's styling.

### Does SMS autofill work?

Yes. There is one real input with `autoComplete="one-time-code"`, so iOS and Android offer the code from a message.

### How does paste work?

Pasting a whole code into any slot fills them all, trimmed to `maxLength` and filtered by `pattern`.

### Can I allow digits only?

Pass `pattern={REGEXP_ONLY_DIGITS}` (exported by `input-otp`); letters are then ignored as they are typed.

### How do I submit when the code is complete?

Use `onComplete`, which fires once every slot is filled, or check the length in `onChange`.
