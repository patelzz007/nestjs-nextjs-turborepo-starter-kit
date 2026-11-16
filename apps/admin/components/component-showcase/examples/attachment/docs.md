## Installation

The attachment parts ship with the kit in `packages/ui/src/components/attachment.tsx`; there is nothing to install.

```showcase-example
c-attachment-1
```

## Usage

```tsx
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentMedia,
	AttachmentTitle,
} from "@workspace/ui/components/attachment";
```

```tsx
<Attachment state={upload.state}>
	<AttachmentMedia>
		<FileType type="pdf" />
	</AttachmentMedia>
	<AttachmentContent>
		<AttachmentTitle>Invoice March.pdf</AttachmentTitle>
		<AttachmentDescription>2.4 MB</AttachmentDescription>
	</AttachmentContent>
	<AttachmentActions>
		<AttachmentAction aria-label="Remove Invoice March.pdf" onClick={remove}>
			<X aria-hidden="true" />
		</AttachmentAction>
	</AttachmentActions>
</Attachment>
```

## Examples

### Composer tray

```showcase-example
c-attachment-2
```

### Three sizes

```showcase-example
c-attachment-4
```

### Upload queue

```showcase-example
c-attachment-5
```

## API Reference

```showcase-api

```

## Accessibility

- The title and the state are text; icon-only actions need an `aria-label` naming the file.
