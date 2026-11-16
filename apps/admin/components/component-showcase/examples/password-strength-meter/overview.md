## When to use

- Sign-up and password-change forms that should explain why a password is weak
- Any form that sets a secret against a policy, with the rules shown as they are met

## When not to use

- Signing in with an existing password: there is nothing to score, use [Password Input](/components/password-input) on its own
- A progress value that is not a password's strength: use [Progress](/components/progress)

## Notes

- The meter only displays: compute `score`, `label`, `percent` and `criteria` yourself (the showcase example uses the app's password rules) and pass them in
- Show it once people start typing, not before

## Password Strength Meter: feedback while a password is set

`PasswordStrengthMeter` draws a segmented strength bar, a word for the strength ("Weak", "Strong") and, optionally, the policy's rules with a tick against each one that is met.

### What is Password Strength Meter?

A presentational component for password feedback. It takes a score and the rules from your own policy, so the meter always agrees with what the server enforces.

### Why use Password Strength Meter?

"Password does not meet requirements" after submitting is frustrating. Showing the rules and the strength as people type lets them fix the password before they press save.

### Password Strength Meter features

- **Segmented bar.** Coloured by strength tier.
- **Rule checklist.** Each criterion with a met or unmet mark.
- **Missing rules.** An alternative `missing` list for a compact summary.
- **Localised.** Its strings come from the `passwordStrengthMeter` labels.

## Integrating with other components

Place it under a [Password Input](/components/password-input) inside a [Field](/components/field). The score usually comes from the same Zod-backed rules the form validates against.

## Frequently asked questions

### Where does the score come from?

From your code. Score the password with your own rules (length, character classes, a breach check if you have one) and pass the result; the meter does no scoring of its own.

### Should a weak password block submission?

Enforce the policy in the schema and on the server, not in the meter. The meter explains the policy; validation enforces it.
