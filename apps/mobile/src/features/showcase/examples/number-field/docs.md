## Installation

`NumberField` ships with the kit in `packages/ui-native/src/components/number-field.tsx`; there is nothing to install.

```showcase-example
c-number-field-1
```

## Usage

```tsx
import { NumberField } from "@workspace/ui-native/components/number-field";
```

```tsx
<NumberField value={quantity} onChange={setQuantity} min={1} max={10} accessibilityLabel="Quantity" />
```

## Layouts

Where the steppers sit.

```showcase-example
c-number-field-1
```

```showcase-example
c-number-field-4
```

```showcase-example
c-number-field-5
```

## In a form

With a rule and an error.

```showcase-example
c-number-field-6
```

## API Reference

```showcase-api

```

## Accessibility

- The field is adjustable: swipe up or down to step it.
- Each stepper is named (Increase, Decrease) and disabled at its bound.
