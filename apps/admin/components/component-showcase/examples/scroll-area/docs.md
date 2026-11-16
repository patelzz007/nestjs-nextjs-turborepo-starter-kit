## Installation

`ScrollArea` and `ScrollBar` ship with the kit in `packages/ui/src/components/scroll-area.tsx`, built on Base UI's scroll area; there is nothing to install.

```showcase-example
c-scroll-area-1
```

## Usage

```tsx
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
```

```tsx
<ScrollArea className="h-72 w-48 rounded-md border">{/* a long list */}</ScrollArea>

<ScrollArea className="w-96 whitespace-nowrap">
	{/* a wide row */}
	<ScrollBar orientation="horizontal" />
</ScrollArea>
```

## Examples

### Horizontal

```showcase-example
c-scroll-area-2
```

### Both scrollbars

```showcase-example
c-scroll-area-3
```

### Fade edges

```showcase-example
c-scroll-area-4
```

## API Reference

```showcase-api

```

## Accessibility

- Scrolling is native; the drawn scrollbars are additions, hidden from assistive technology.
- When the region holds no focusable content, make it focusable so keyboard users can scroll it.
