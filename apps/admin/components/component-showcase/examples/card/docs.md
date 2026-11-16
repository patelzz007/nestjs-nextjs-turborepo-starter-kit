## Installation

The card parts ship with the kit in `packages/ui/src/components/card.tsx`; there is nothing to install.

```showcase-example
c-card-1
```

## Usage

```tsx
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
```

```tsx
<Card>
	<CardHeader>
		<CardTitle>Usage</CardTitle>
		<CardDescription>This billing period.</CardDescription>
		<CardAction>
			<Button variant="link" size="sm">
				Details
			</Button>
		</CardAction>
	</CardHeader>
	<CardContent>{/* the meter */}</CardContent>
	<CardFooter>
		<Button>Upgrade</Button>
	</CardFooter>
</Card>
```

## Examples

### Header and footer

```showcase-example
c-card-4
```

### Inset image

```showcase-example
c-card-7
```

### Billing usage

```showcase-example
c-card-13
```

### Stat trend

```showcase-example
c-card-15
```

## API Reference

```showcase-api

```

## Accessibility

- A plain container; `CardTitle` gives it a heading-styled title — render it as a real heading where the page outline needs one.
