## Installation

The popover parts ship with the kit in `packages/ui/src/components/popover.tsx`, built on Base UI's popover; there is nothing to install.

```showcase-example
c-popover-1
```

## Usage

```tsx
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover";
```

```tsx
<Popover>
	<PopoverTrigger render={<Button variant="outline" />}>Dimensions</PopoverTrigger>
	<PopoverContent className="w-80">
		<PopoverHeader>
			<PopoverTitle>Dimensions</PopoverTitle>
			<PopoverDescription>Set the layer's size.</PopoverDescription>
		</PopoverHeader>
		{/* the fields */}
	</PopoverContent>
</Popover>
```

## Examples

### Opening sides

```showcase-example
c-popover-2
```

### Inline form

```showcase-example
c-popover-3
```

### Profile card

```showcase-example
c-popover-6
```

### Step tour

```showcase-example
c-popover-11
```

## API Reference

```showcase-api

```

## Keyboard

| Key             | Action                                      |
| :-------------- | :------------------------------------------ |
| `Enter` `Space` | Opens the popover from its trigger.         |
| `Esc`           | Closes it and returns focus to the trigger. |
| `Tab`           | Moves through the popover's content.        |

## Accessibility

- The trigger exposes `aria-expanded` and controls the popup; focus moves into the popup on open.
- Name the popup with `PopoverTitle` (or `aria-label` on the content).
