## Installation

The frame parts ship with the kit in `packages/ui/src/components/frame.tsx`; there is nothing to install.

```showcase-example
c-frame-1
```

## Usage

```tsx
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";
```

```tsx
<Frame>
	<FramePanel>
		<FrameHeader>
			<FrameTitle>Services</FrameTitle>
			<FrameDescription>All systems operational.</FrameDescription>
		</FrameHeader>
		<div className="p-5">{/* content */}</div>
		<FrameFooter>Updated a minute ago</FrameFooter>
	</FramePanel>
</Frame>
```

Customise the radius of the frame and its panels with the `--frame-radius` variable:

```tsx
<Frame className="[--frame-radius:var(--radius-lg)]">
	<FramePanel>…</FramePanel>
</Frame>
```

## Examples

### Separated panels

```showcase-example
c-frame-2
```

### Stacked panels

```showcase-example
c-frame-3
```

### Collapsible panels

```showcase-example
c-frame-5
```

### Dense layout

```showcase-example
c-frame-7
```

## API Reference

```showcase-api

```

## Accessibility

- A layout container: give each section a heading so it appears in the page's outline.
