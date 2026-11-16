## Installation

The message parts ship with the kit in `packages/ui/src/components/message.tsx`; there is nothing to install.

```showcase-example
c-message-1
```

## Usage

```tsx
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@workspace/ui/components/message";
```

```tsx
<Message>
	<MessageAvatar>
		<UserAvatar name={author.name} image={author.avatar} drawnSize={32} />
	</MessageAvatar>
	<MessageHeader className="gap-2">
		<span className="font-medium">{author.name}</span>
		<RelativeTime epochMs={sentAtEpochMs} region={region} />
	</MessageHeader>
	<MessageContent>
		<Bubble>
			<BubbleContent>{text}</BubbleContent>
		</Bubble>
	</MessageContent>
</Message>
```

## Examples

### Sender and status

```showcase-example
c-message-3
```

### Reply actions

```showcase-example
c-message-4
```

### Shared files

```showcase-example
c-message-5
```

### Streaming reply

```showcase-example
c-message-7
```

## API Reference

```showcase-api

```

## Accessibility

- Name the sender in text in the header; read receipts and statuses need words as well as icons.
