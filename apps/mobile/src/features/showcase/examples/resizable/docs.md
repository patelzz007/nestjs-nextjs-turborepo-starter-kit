## Installation

`ResizableGroup` ships with the kit in `packages/ui-native/src/components/resizable.tsx`; there is nothing to install.

```showcase-example
c-resizable-1
```

## Usage

```tsx
import { ResizableGroup, ResizablePanel } from "@workspace/ui-native/components/resizable";
```

```tsx
<ResizableGroup defaultSizes={[25, 75]}>
	<ResizablePanel>{SIDEBAR}</ResizablePanel>
	<ResizablePanel>{CONTENT}</ResizablePanel>
</ResizableGroup>
```

## Nested

```showcase-example
c-resizable-3
```

```showcase-example
c-resizable-8
```

## Handles

```showcase-example
c-resizable-4
```

```showcase-example
c-resizable-5
```

## Three panels

```showcase-example
c-resizable-9
```

## Sizes in state

```showcase-example
c-resizable-10
```

## API Reference

```showcase-api

```

## Accessibility

- Each handle is adjustable, named "Resize <panel> and <panel>", with its split as its value.
- Swipe up or down (VoiceOver) or use the volume keys (TalkBack) to step it.
