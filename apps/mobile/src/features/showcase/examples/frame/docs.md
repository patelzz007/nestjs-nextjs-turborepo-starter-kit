## Installation

`Frame` ships with the kit in `packages/ui-native/src/components/frame.tsx`; there is nothing to install.

```showcase-example
c-frame-1
```

## Usage

```tsx
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
```

```tsx
<Frame>
	<FrameHeader>
		<FrameTitle>{title}</FrameTitle>
	</FrameHeader>
	<FramePanel>{content}</FramePanel>
</Frame>
```

## Panels

```showcase-example
c-frame-2
```

```showcase-example
c-frame-3
```

```showcase-example
c-frame-4
```

## Spacing

```showcase-example
c-frame-9
```

```showcase-example
c-frame-10
```

```showcase-example
c-frame-12
```

## Radius

```showcase-example
c-frame-13
```

```showcase-example
c-frame-17
```

## API Reference

```showcase-api

```

## Accessibility

- The title is a header for screen readers.
- The tray and panels are layout only: their content is read in order.
