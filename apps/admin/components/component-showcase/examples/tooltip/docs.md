## Installation

The tooltip parts ship with the kit in `packages/ui/src/components/tooltip.tsx`, built on Base UI's tooltip; there is nothing to install.

```showcase-example
c-tooltip-1
```

## Usage

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";
```

```tsx
<TooltipProvider>
	<Tooltip>
		<TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Bold" />}>
			<Bold aria-hidden="true" />
		</TooltipTrigger>
		<TooltipContent>
			Bold <Kbd>⌘B</Kbd>
		</TooltipContent>
	</Tooltip>
</TooltipProvider>
```

## Examples

### Placements

```showcase-example
c-tooltip-2
```

### Keyboard shortcut

```showcase-example
c-tooltip-4
```

### Toolbar actions

```showcase-example
c-tooltip-8
```

### Disabled button

```showcase-example
c-tooltip-12
```

## API Reference

```showcase-api

```

## Accessibility

- The tooltip opens on keyboard focus as well as hover, and Escape closes it.
- Its text describes the trigger; keep the trigger's own name (`aria-label`) in step with it.
- It holds no interactive content: a link or a button inside a tooltip cannot be reached by keyboard.
