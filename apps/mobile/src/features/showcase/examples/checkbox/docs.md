## Installation

`Checkbox` ships with the kit in `packages/ui-native/src/components/checkbox.tsx`; there is nothing to install.

```showcase-example
c-checkbox-2
```

## Usage

```tsx
import { Checkbox } from "@workspace/ui-native/components/checkbox";
```

```tsx
<Checkbox label="Accept the terms" checked={accepted} onChange={setAccepted} />
```

## States

Disabled, invalid, mixed.

```showcase-example
c-checkbox-2
```

```showcase-example
c-checkbox-4
```

## Rows and cards

The box at the end, with an icon.

```showcase-example
c-checkbox-9
```

```showcase-example
c-checkbox-12
```

## Nested

A parent over its children.

```showcase-example
c-checkbox-16
```

## API Reference

```showcase-api

```

## Accessibility

- Announced as a checkbox, checked, unchecked or mixed, named by its label.
- The whole row is the touch target.
