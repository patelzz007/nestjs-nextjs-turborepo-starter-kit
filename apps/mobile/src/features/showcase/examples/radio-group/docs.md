## Installation

`RadioGroup` ships with the kit in `packages/ui-native/src/components/radio-group.tsx`; there is nothing to install.

```showcase-example
c-radio-group-3
```

## Usage

```tsx
import { RadioGroup } from "@workspace/ui-native/components/radio-group";
```

```tsx
<RadioGroup label="Shipping" options={SHIPPING} value={shipping} onChange={setShipping} />
```

## Looks

Cards and descriptions.

```showcase-example
c-radio-group-3
```

```showcase-example
c-radio-group-7
```

## Layouts

Horizontal and grid.

```showcase-example
c-radio-group-16
```

```showcase-example
c-radio-group-11
```

## Extras

Badges and tooltips.

```showcase-example
c-radio-group-15
```

```showcase-example
c-radio-group-14
```

## API Reference

```showcase-api

```

## Accessibility

- A radio group named by its label; each option a radio, checked or not.
- Descriptions are read as hints.
