## Installation

`PasswordStrengthMeter` ships with the kit in `packages/ui-native/src/components/password-strength-meter.tsx`; there is nothing to install.

```showcase-example
c-password-strength-meter-1
```

## Usage

```tsx
import { PasswordStrengthMeter } from "@workspace/ui-native/components/password-strength-meter";
```

```tsx
<PasswordStrengthMeter score={met} label="Fair" percent={50} criteria={criteria} />
```

## With a password field

Scored as it is typed.

```showcase-example
c-password-strength-meter-1
```

## API Reference

```showcase-api

```

## Accessibility

- Each rule is read with whether it is met.
- The bar's level is read as its label.
