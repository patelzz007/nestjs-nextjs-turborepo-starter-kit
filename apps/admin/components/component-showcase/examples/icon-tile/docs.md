## Installation

`IconTile` ships with the kit in `packages/ui/src/components/icon-tile.tsx`; there is nothing to install.

```showcase-example
c-icon-tile-1
```

## Usage

```tsx
import { IconTile } from "@workspace/ui/components/icon-tile";
```

```tsx
<IconTile tone="blue" variant="tint" aria-hidden="true">
	<FolderIcon />
</IconTile>
```

## Examples

### Every variant

```showcase-example
c-icon-tile-4
```

### Sizes

```showcase-example
c-icon-tile-5
```

### Colour tones

```showcase-example
c-icon-tile-8
```

### List row

```showcase-example
c-icon-tile-10
```

### Status overlay

```showcase-example
c-icon-tile-14
```

## API Reference

```showcase-api

```

## Accessibility

- Decorative by default: `aria-hidden="true"` with the meaning in nearby text.
- A tile that carries information on its own (a count, a status) needs an accessible name.
