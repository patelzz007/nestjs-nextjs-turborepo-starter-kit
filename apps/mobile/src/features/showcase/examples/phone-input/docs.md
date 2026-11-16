## Installation

`PhoneInput` ships with the kit in `packages/ui-native/src/components/phone-input.tsx`; there is nothing to install.

```showcase-example
c-phone-input-7
```

## Usage

```tsx
import { PhoneInput } from "@workspace/ui-native/components/phone-input";
```

```tsx
<PhoneInput value={phone} onChange={setPhone} defaultCountry="MY" accessibilityLabel="Phone" />
```

## Countries

A default, or from the number.

```showcase-example
c-phone-input-7
```

```showcase-example
c-phone-input-5
```

## States

Error, disabled, read only.

```showcase-example
c-phone-input-6
```

```showcase-example
c-phone-input-8
```

## API Reference

```showcase-api

```

## Accessibility

- The country button says the picked country ("Country: Malaysia").
- The number field brings up the phone keypad and phone autofill.
