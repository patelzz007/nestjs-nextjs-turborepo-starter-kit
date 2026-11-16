## Installation

`Popover` ships with the kit in `packages/ui-native/src/components/popover.tsx`; there is nothing to install.

```showcase-example
c-popover-1
```

## Usage

```tsx
import { Popover } from "@workspace/ui-native/components/popover";
```

```tsx
<Popover content={CONTENT} accessibilityLabel="Dimensions">
	<Button label="Open" variant="outline" onPress={noop} />
</Popover>
```

## Placement

```showcase-example
c-popover-2
```

```showcase-example
c-popover-4
```

## Controls inside

```showcase-example
c-popover-3
```

```showcase-example
c-popover-10
```

## Rich content

```showcase-example
c-popover-6
```

```showcase-example
c-popover-11
```

## API Reference

```showcase-api

```

## Accessibility

- The trigger's hint says what it opens ("Opens dimensions").
- The panel is a window of its own, named by `accessibilityLabel`; screen readers stay inside until it closes.
- The system back closes it.
