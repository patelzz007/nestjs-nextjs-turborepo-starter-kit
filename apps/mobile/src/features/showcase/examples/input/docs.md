## Installation

`Input` ships with the kit in `packages/ui-native/src/components/input.tsx`; there is nothing to install.

```showcase-example
c-input-2
```

## Usage

```tsx
import { Input } from "@workspace/ui-native/components/input";
```

```tsx
<Input value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Email" />
```

## In a field

Label, hint and error from `Field`.

```showcase-example
c-input-2
```

```showcase-example
c-input-5
```

## Keyboards

The keyboard follows the value's kind.

```showcase-example
c-input-8
```

```showcase-example
c-input-9
```

## Looks

Filled, underline and ghost.

```showcase-example
c-input-26
```

```showcase-example
c-input-27
```

## API Reference

```showcase-api

```

## Accessibility

- The input is named by its field's label (or `accessibilityLabel`).
- Disabled and loading inputs take no typing and are announced so.
- Autofill hints (`textContentType`, `autoComplete`) let the platform fill passwords and addresses.
