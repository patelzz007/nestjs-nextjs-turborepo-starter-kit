## When to use

- Sign-in, sign-up and password-change forms
- Any secret people type and may want to check before submitting, such as an API key or a PIN they set

## When not to use

- A one-time code sent by SMS or email: use [Input OTP](/components/input-otp)
- A value that is not secret: use [Input](/components/input)

## Notes

- The show/hide toggle can be controlled with `visible` and `onVisibleChange`, or left uncontrolled with `defaultVisible`
- `ref` reaches the inner `input`, so a form library's focus-on-error works

## Password Input: show, hide and a Caps Lock warning

`PasswordInput` is an `Input` with two additions: an eye button that switches the field between hidden and visible text, and a warning that appears under the field while it has focus and Caps Lock is on.

### What is Password Input?

A password field that helps people type the password they mean. Showing it lets them check a long password on a phone; the Caps Lock hint explains a rejected password before they try again.

### Why use Password Input?

Rejected passwords are often Caps Lock or a typo. Letting people reveal what they typed, and warning about Caps Lock, cuts failed sign-ins without weakening anything: the value is never shown unless they ask.

### Password Input features

- **Show and hide.** An inline toggle, controlled (`visible` / `onVisibleChange`) or uncontrolled (`defaultVisible`).
- **Caps Lock warning.** Shown while focused with Caps Lock on, cleared on blur.
- **A plain input underneath.** `value`, `onChange`, `onBlur`, `autoComplete` and `ref` all pass through.
- **Localised.** The toggle's names and the warning come from the `passwordInput` labels.

## Integrating with other components

Put it in a [Field](/components/field) with a [Label](/components/label), and pair it with [Password Strength Meter](/components/password-strength-meter) on sign-up and password-change forms.

## Frequently asked questions

### Should the password be visible by default?

No: start hidden and let people reveal it. On sign-up, a visible password lets people check what they set, so consider `defaultVisible` there only if your security policy allows it.

### Which `autoComplete` value should I use?

`current-password` on sign-in and `new-password` on sign-up and change forms, so password managers fill and save the right thing.

### Is it accessible?

The toggle is a button named for what it will do ("Show password" / "Hide password"). It is kept out of the tab order, so Tab goes from the password straight to the next control; the Caps Lock warning is a polite status, announced as it appears.
