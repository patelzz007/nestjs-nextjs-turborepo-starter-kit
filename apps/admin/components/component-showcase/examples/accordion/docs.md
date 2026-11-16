## Installation

The accordion parts ship with the kit in `packages/ui/src/components/accordion.tsx`, built on Base UI's accordion; there is nothing to install.

```showcase-example
c-accordion-1
```

## Usage

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";
```

```tsx
<Accordion defaultValue={["shipping"]}>
	<AccordionItem value="shipping">
		<AccordionTrigger>How long does shipping take?</AccordionTrigger>
		<AccordionContent>Three to five working days.</AccordionContent>
	</AccordionItem>
	<AccordionItem value="returns">
		<AccordionTrigger>Can I return an item?</AccordionTrigger>
		<AccordionContent>Within 30 days, unused.</AccordionContent>
	</AccordionItem>
</Accordion>
```

## Examples

### Plus and minus icons

```showcase-example
c-accordion-2
```

### Icons and badges

```showcase-example
c-accordion-6
```

### Nested

```showcase-example
c-accordion-8
```

### Setup steps

```showcase-example
c-accordion-11
```

## API Reference

```showcase-api

```

## Keyboard

| Key             | Action                                 |
| :-------------- | :------------------------------------- |
| `Enter` `Space` | Opens or closes the focused item.      |
| `↓` `↑`         | Moves to the next or previous trigger. |
| `Home` `End`    | Moves to the first or last trigger.    |

## Accessibility

- Each trigger is a button with `aria-expanded` and `aria-controls`; each panel is a region named by its trigger.
