## When to use

- Under a new password on sign-up or a password change
- A checklist of the rules a password still misses
- A bar that grows as the password gets stronger

## When not to use

- A password being typed to sign in: strength does not matter there
- Validation: the form's schema decides whether a password is accepted
- Any other progress: use [Progress](/showcase/progress)

## Notes

- The meter only shows what it is given: the caller scores the password and lists its rules
- Each rule is read out with whether it is met

## PasswordStrengthMeter: how strong a new password is

`PasswordStrengthMeter` shows a score as a segmented bar with its label, and a checklist of rules ticked off as the password meets them.

### What is it?

A bar and a checklist, both drawn from the score and rules the caller passes.

### Why use it?

People choose stronger passwords when they can see what is missing.

### Features

- **Segmented bar.** `score` and `percent`.
- **Label.** "Weak", "Strong"…
- **Checklist.** `criteria`, each met or not.
- **Compact size.** `sm` under a small field.

## Integrating with other components

Put it under a [PasswordInput](/showcase/password-input) in a [Field](/showcase/field).

## Frequently asked questions

### Who scores the password?

The caller: the rules are your product's (length, cases, digits). The meter draws them.
