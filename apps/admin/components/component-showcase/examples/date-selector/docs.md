## Installation

`DateSelector` ships with the kit in `packages/ui/src/components/date-selector.tsx`, built on the kit's `Calendar`; there is nothing to install.

```showcase-example
c-date-selector-1
```

## Usage

```tsx
import { DateSelector, type DateSelectorValue } from "@workspace/ui/components/date-selector";
```

```tsx
const [value, setValue] = React.useState<DateSelectorValue | undefined>();

return <DateSelector value={value} onChange={setValue} />;
```

## Examples

### In a popover

```showcase-example
c-date-selector-2
```

### In a dialog

```showcase-example
c-date-selector-3
```

### Localised

```showcase-example
c-date-selector-4
```

## API Reference

```showcase-api

```

## Accessibility

- The period tabs, the operator choice and the period grids are keyboard-operable kit controls with names.
- The value's summary is text, read with the selector.
