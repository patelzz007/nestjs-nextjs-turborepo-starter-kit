## Installation

`AspectRatio` ships with the kit in `packages/ui/src/components/aspect-ratio.tsx`; there is nothing to install.

```showcase-example
c-aspect-ratio-1
```

## Usage

```tsx
import { AspectRatio } from "@workspace/ui/components/aspect-ratio";
```

```tsx
<div className="w-full max-w-md">
	<AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg bg-muted">
		<img src={banner.url} alt={banner.alt} className="size-full object-cover" />
	</AspectRatio>
</div>
```

## Examples

### Square

```showcase-example
c-aspect-ratio-3
```

### Tall portrait

```showcase-example
c-aspect-ratio-5
```

## API Reference

```showcase-api

```

## Accessibility

- A layout box: the media inside carries the meaning, so give images a real `alt`.
