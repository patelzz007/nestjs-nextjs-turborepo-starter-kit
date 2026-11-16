## Installation

`StatTiles` ships with the kit in `packages/ui-native/src/components/stat-tiles.tsx`; there is nothing to install.

```showcase-example
c-stat-card-1
```

## Usage

```tsx
import { StatTiles } from "@workspace/ui-native/components/stat-tiles";
```

```tsx
<StatTiles items={[{ label: "Orders today", value: "128", hint: "+12 since noon" }]} />
```

## API Reference

```showcase-api

```

## Accessibility

- Each tile is one element, read as “label: value”, then its hint.
