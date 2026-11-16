## Installation

The alert parts ship with the kit in `packages/ui/src/components/alert.tsx`; there is nothing to install.

```showcase-example
c-alert-1
```

## Usage

```tsx
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
```

```tsx
<Alert variant="warning">
	<AlertTitle>Your card expires soon</AlertTitle>
	<AlertDescription>Update it before 30 November to keep your plan.</AlertDescription>
	<AlertAction>
		<Button size="sm">Update card</Button>
	</AlertAction>
</Alert>
```

## Examples

### Icon and actions

```showcase-example
c-alert-3
```

### Variants

```showcase-example
c-alert-5
```

```showcase-example
c-alert-6
```

```showcase-example
c-alert-7
```

```showcase-example
c-alert-8
```

```showcase-example
c-alert-9
```

### Stacked in a frame

```showcase-example
c-alert-13
```

## API Reference

```showcase-api

```

## Accessibility

- `role="alert"` by default (announced at once); pass `role="status"` for a polite announcement.
- The variant's colour always comes with an icon and text, never alone.
