## Installation

The bubble parts ship with the kit in `packages/ui/src/components/bubble.tsx`; there is nothing to install.

```showcase-example
c-bubble-1
```

## Usage

```tsx
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "@workspace/ui/components/bubble";
```

```tsx
<div className="flex flex-col gap-2">
	<Bubble>
		<BubbleContent>Is my order on its way?</BubbleContent>
	</Bubble>
	<Bubble align="end">
		<BubbleContent>Yes — it ships today.</BubbleContent>
	</Bubble>
</div>
```

## Examples

### All variants

```showcase-example
c-bubble-2
```

### Grouped messages

```showcase-example
c-bubble-3
```

### Reactions

```showcase-example
c-bubble-4
```

### Quick replies

```showcase-example
c-bubble-6
```

## API Reference

```showcase-api

```

## Accessibility

- Bubbles are text; make the sender explicit in text, not only by side and colour.
