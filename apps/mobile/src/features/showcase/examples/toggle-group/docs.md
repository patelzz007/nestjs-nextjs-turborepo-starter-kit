## Installation

`ToggleGroup` ships with the kit in `packages/ui-native/src/components/toggle-group.tsx`; there is nothing to install.

```showcase-example
c-toggle-group-2
```

## Usage

```tsx
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
```

```tsx
const [view, setView] = React.useState<string | null>("list");

<ToggleGroup type="single" label="View" options={VIEWS} value={view} onChange={setView} />;
```

## Single and multiple

One value, or several.

```showcase-example
c-toggle-group-2
```

```showcase-example
c-toggle-group-1
```

## Segmented

`spacing="attached"` joins the chips.

```showcase-example
c-toggle-group-8
```

```showcase-example
c-toggle-group-16
```

## Vertical

`orientation="vertical"` stacks them.

```showcase-example
c-toggle-group-9
```

## API Reference

```showcase-api

```

## Accessibility

- A single group has the radio group role; a multiple group the group role. Each chip reports `checked`.
- Icon-only chips keep their labels as names; `accessibilityLabel` on an option says shorthand in full ("24 hours").
