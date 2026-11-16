## Installation

The marker parts ship with the kit in `packages/ui/src/components/marker.tsx`; there is nothing to install.

```showcase-example
c-marker-1
```

## Usage

```tsx
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker";
```

```tsx
<Marker>
	<MarkerIcon>
		<FileText />
	</MarkerIcon>
	<MarkerContent>Read 3 files</MarkerContent>
</Marker>
```

## Examples

### Tool-call log

```showcase-example
c-marker-2
```

### Phase separators

```showcase-example
c-marker-4
```

### Links and action

```showcase-example
c-marker-6
```

## API Reference

```showcase-api

```

## Accessibility

- `MarkerIcon` is hidden from assistive technology; `MarkerContent` must carry the meaning.
