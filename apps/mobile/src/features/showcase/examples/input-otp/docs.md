## Installation

`InputOTP` ships with the kit in `packages/ui-native/src/components/input-otp.tsx`; there is nothing to install.

```showcase-example
c-input-otp-2
```

## Usage

```tsx
import { InputOTP } from "@workspace/ui-native/components/input-otp";
```

```tsx
<InputOTP value={code} onChange={setCode} length={6} keyboardType="number-pad" accessibilityLabel="Code" />
```

## Digits

A numeric code.

```showcase-example
c-input-otp-2
```

## Letters and digits

`normalize` keeps both.

```showcase-example
c-input-otp-4
```

## In a card

With a resend action.

```showcase-example
c-input-otp-6
```

## API Reference

```showcase-api

```

## Accessibility

- The code is one field for screen readers, named by its label.
- The keyboard's one-time-code suggestion fills it.
