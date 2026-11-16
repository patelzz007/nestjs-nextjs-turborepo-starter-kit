## Installation

`PasswordStrengthMeter` ships with the kit in `packages/ui/src/components/password-strength-meter.tsx`; there is nothing to install.

```showcase-example
c-password-strength-meter-1
```

## Usage

```tsx
import { PasswordStrengthMeter } from "@workspace/ui/components/password-strength-meter";
```

```tsx
<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
```

Each criterion is `{ label, met }`; `score` picks the colour tier and `percent` fills the bar.

## API Reference

```showcase-api

```

## Accessibility

- The strength word is text, so it is read with the meter; the bar itself is decorative.
- Each rule is listed with its state in words, not only by colour.
