## Installation

`Collapsible` ships with the kit in `packages/ui-native/src/components/collapsible.tsx`; there is nothing to install.

```showcase-example
c-collapsible-1
```

## Usage

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
```

```tsx
<Collapsible open={open} onOpenChange={setOpen} variant="card">
	<CollapsibleTrigger label="Order details" />
	<CollapsibleContent>
		<Text>{DETAILS}</Text>
	</CollapsibleContent>
</Collapsible>
```

## Cards

```showcase-example
c-collapsible-6
```

```showcase-example
c-collapsible-7
```

## Opened from elsewhere

```showcase-example
c-collapsible-5
```

## API Reference

```showcase-api

```

## Accessibility

- The trigger is a button that says whether the region is expanded.
- The closed region is not rendered, so it is not read or focused.
