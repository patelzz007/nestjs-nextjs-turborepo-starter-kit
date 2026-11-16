## Installation

The empty parts ship with the kit in `packages/ui/src/components/empty.tsx`; there is nothing to install.

```showcase-example
c-empty-1
```

## Usage

```tsx
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
```

```tsx
<Empty>
	<EmptyHeader>
		<EmptyMedia variant="icon">
			<Store aria-hidden="true" />
		</EmptyMedia>
		<EmptyTitle>No merchants yet</EmptyTitle>
		<EmptyDescription>Add your first merchant to start issuing rewards.</EmptyDescription>
	</EmptyHeader>
	<EmptyContent>
		<Button>Add merchant</Button>
	</EmptyContent>
</Empty>
```

## Examples

### No results

```showcase-example
c-empty-2
```

### Dashed upload

```showcase-example
c-empty-6
```

### Team members

```showcase-example
c-empty-8
```

## API Reference

```showcase-api

```

## Accessibility

- Plain content: keep the title and description short, and make the action a real button or link.
- Icons and illustrations are decorative (`aria-hidden`).
