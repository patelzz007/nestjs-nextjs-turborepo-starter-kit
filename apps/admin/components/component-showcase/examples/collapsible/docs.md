## Installation

The collapsible parts ship with the kit in `packages/ui/src/components/collapsible.tsx`, built on Base UI's collapsible; there is nothing to install.

```showcase-example
c-collapsible-1
```

## Usage

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
```

```tsx
<Collapsible>
	<CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>Show details</CollapsibleTrigger>
	<CollapsibleContent>{/* the details */}</CollapsibleContent>
</Collapsible>
```

## Examples

### Animated card

```showcase-example
c-collapsible-3
```

### Form fields

```showcase-example
c-collapsible-5
```

### Multi-level menu

```showcase-example
c-collapsible-9
```

## API Reference

```showcase-api

```

## Accessibility

- The trigger is a button with `aria-expanded` and `aria-controls`; Enter or Space toggles it.
