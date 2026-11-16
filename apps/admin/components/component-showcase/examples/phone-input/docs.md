## Installation

`PhoneInput` ships with the kit in `packages/ui/src/components/phone-input.tsx`, built on the `react-phone-number-input` package, which is already installed.

```showcase-example
c-phone-input-1
```

## Usage

```tsx
import { PhoneInput } from "@workspace/ui/components/phone-input";
```

```tsx
<Label htmlFor="phone">Phone</Label>
<PhoneInput id="phone" defaultCountry="MY" value={phone} onChange={setPhone} aria-invalid={isInvalid} />
```

The value is E.164 (`+60123456789`), or `undefined` while the field is empty.

## Examples

### Sizes

```showcase-example
c-phone-input-2
```

```showcase-example
c-phone-input-3
```

### Error state

```showcase-example
c-phone-input-6
```

### Read-only

```showcase-example
c-phone-input-8
```

## API Reference

```showcase-api

```

## Accessibility

- The country picker is a button that opens a searchable list; its name says which country is chosen.
- The number field is a native `tel` input: name it with a label or `aria-label`.
- `aria-invalid` marks both parts as invalid.
