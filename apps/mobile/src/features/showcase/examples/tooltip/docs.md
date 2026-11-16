## Installation

`Tooltip` ships with the kit in `packages/ui-native/src/components/tooltip.tsx`; there is nothing to install.

```showcase-example
c-tooltip-1
```

## Usage

```tsx
import { Tooltip } from "@workspace/ui-native/components/tooltip";
```

```tsx
<Tooltip content="Plan info" accessibilityLabel="Info" asChild>
	<IconButton icon={InfoIcon} label="Info" onPress={noop} />
</Tooltip>
```

## On controls

```showcase-example
c-tooltip-3
```

```showcase-example
c-tooltip-8
```

## Rich content

```showcase-example
c-tooltip-6
```

```showcase-example
c-tooltip-11
```

## Disabled controls

```showcase-example
c-tooltip-12
```

## API Reference

```showcase-api

```

## Accessibility

- The text is the element's accessibility hint, so screen readers hear it without the gesture.
- The bubble is hidden from screen readers: it repeats the hint.
- Rich bubbles keep `content` as a plain sentence for the hint.
