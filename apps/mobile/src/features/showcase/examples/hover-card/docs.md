## Installation

`HoverCard` ships with the kit in `packages/ui-native/src/components/hover-card.tsx`; there is nothing to install.

```showcase-example
c-hover-card-1
```

## Usage

```tsx
import { HoverCard } from "@workspace/ui-native/components/hover-card";
```

```tsx
<HoverCard content={PREVIEW} accessibilityLabel="Ava Patel">
	<Button label="@ava" variant="ghost" onPress={openProfile} />
</HoverCard>
```

## Previews

```showcase-example
c-hover-card-3
```

```showcase-example
c-hover-card-8
```

## API Reference

```showcase-api

```

## Accessibility

- The trigger's hint says "Long press to preview …".
- The card is a window of its own; the system back closes it.
