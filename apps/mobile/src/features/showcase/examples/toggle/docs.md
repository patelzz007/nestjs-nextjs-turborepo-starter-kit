## Installation

`Toggle` ships with the kit in `packages/ui-native/src/components/toggle.tsx`; there is nothing to install.

```showcase-example
c-toggle-1
```

## Usage

```tsx
import { Toggle } from "@workspace/ui-native/components/toggle";
```

```tsx
const [bold, setBold] = React.useState(false);

<Toggle label="Bold" icon={BoldIcon} hideLabel pressed={bold} onChange={setBold} />;
```

## Looks and sizes

`variant` and `size`, like a button's.

```showcase-example
c-toggle-1
```

```showcase-example
c-toggle-2
```

```showcase-example
c-toggle-3
```

## Swapping glyph and label

`pressedIcon` and `pressedLabel` follow the state.

```showcase-example
c-toggle-10
```

```showcase-example
c-toggle-14
```

## Counts

`trailing` shows a count beside the label.

```showcase-example
c-toggle-11
```

## API Reference

```showcase-api

```

## Accessibility

- The toggle has the toggle button role and reports `checked`; its name is `label` (or `pressedLabel` while pressed).
- An icon-only toggle (`hideLabel`) keeps its label as its name.
- The small size keeps a 44 pt touch area.
