## Installation

`Marker` ships with the kit in `packages/ui-native/src/components/marker.tsx`; there is nothing to install.

```showcase-example
c-marker-1
```

## Usage

```tsx
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui-native/components/marker";
```

```tsx
<Marker>
	<MarkerIcon>
		<Icon icon={TerminalIcon} size="sm" colorClassName="accent-muted-foreground" />
	</MarkerIcon>
	<MarkerContent>Ran pnpm test</MarkerContent>
</Marker>
```

## Run logs

```showcase-example
c-marker-2
```

```showcase-example
c-marker-3
```

```showcase-example
c-marker-4
```

## Changed files

```showcase-example
c-marker-5
```

## Links and actions

```showcase-example
c-marker-6
```

## API Reference

```showcase-api

```

## Accessibility

- The glyph is hidden; the text is read.
- A pressable line is a named link or button.
