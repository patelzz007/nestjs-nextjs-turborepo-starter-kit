## Installation

`MessageScroller` ships with the kit in `packages/ui-native/src/components/message-scroller.tsx`; there is nothing to install.

```showcase-example
c-message-scroller-1
```

## Usage

```tsx
import {
	MessageScroller,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@workspace/ui-native/components/message-scroller";
```

```tsx
<MessageScrollerProvider>
	<MessageScroller>
		<MessageScrollerViewport accessibilityLabel="Conversation">
			<MessageScrollerContent>{items}</MessageScrollerContent>
		</MessageScrollerViewport>
	</MessageScroller>
</MessageScrollerProvider>
```

## Streaming

```showcase-example
c-message-scroller-2
```

## Anchored turns

```showcase-example
c-message-scroller-3
```

## Opening position

```showcase-example
c-message-scroller-4
```

## History

```showcase-example
c-message-scroller-5
```

## Navigation

```showcase-example
c-message-scroller-6
```

## API Reference

```showcase-api

```

## Accessibility

- New messages are announced politely (a live region).
- The jump buttons are named by the caller ("Scroll to latest message") and only show when there is somewhere to go.
