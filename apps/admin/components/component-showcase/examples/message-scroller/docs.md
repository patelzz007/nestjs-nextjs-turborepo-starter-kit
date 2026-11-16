## Installation

The message scroller parts ship with the kit in `packages/ui/src/components/message-scroller.tsx`; there is nothing to install.

```showcase-example
c-message-scroller-1
```

## Usage

```tsx
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller";
```

```tsx
<div className="h-[480px]">
	<MessageScrollerProvider>
		<MessageScroller>
			<MessageScrollerViewport>
				<MessageScrollerContent>
					{turns.map((turn) => (
						<MessageScrollerItem key={turn.id}>{/* a Message */}</MessageScrollerItem>
					))}
				</MessageScrollerContent>
			</MessageScrollerViewport>
			<MessageScrollerButton />
		</MessageScroller>
	</MessageScrollerProvider>
</div>
```

## Examples

### Streaming reply

```showcase-example
c-message-scroller-2
```

### Anchored turn

```showcase-example
c-message-scroller-3
```

### Load earlier

```showcase-example
c-message-scroller-5
```

### Thread navigator

```showcase-example
c-message-scroller-6
```

## API Reference

```showcase-api

```

## Accessibility

- The viewport is a focusable, labelled scroll region; the jump-to-latest button is named.
