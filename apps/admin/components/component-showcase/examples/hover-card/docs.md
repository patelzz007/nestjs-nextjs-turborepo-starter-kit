## Installation

The hover card parts ship with the kit in `packages/ui/src/components/hover-card.tsx`, built on Base UI's preview card; there is nothing to install.

```showcase-example
c-hover-card-1
```

## Usage

```tsx
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";
```

```tsx
<HoverCard>
	<HoverCardTrigger render={<a href="/people/ada" />} delay={300}>
		Ada Lovelace
	</HoverCardTrigger>
	<HoverCardContent className="w-72">{/* the preview */}</HoverCardContent>
</HoverCard>
```

## Examples

### Positions

```showcase-example
c-hover-card-2
```

### Profile

```showcase-example
c-hover-card-3
```

### Live timestamp

```showcase-example
c-hover-card-7
```

## API Reference

```showcase-api

```

## Accessibility

- It opens on keyboard focus as well as hover; Escape closes it.
- It supplements a link: the trigger must work on its own, and nothing essential should live only in the card.
