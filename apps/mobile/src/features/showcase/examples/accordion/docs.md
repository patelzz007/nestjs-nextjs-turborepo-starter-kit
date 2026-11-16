## Installation

`Accordion` ships with the kit in `packages/ui-native/src/components/accordion.tsx`; there is nothing to install.

```showcase-example
c-accordion-1
```

## Usage

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui-native/components/accordion";
```

```tsx
<Accordion value={open} onChange={setOpen}>
	<AccordionItem value="a">
		<AccordionTrigger label="Is it accessible?" />
		<AccordionContent>
			<Text>{ANSWER}</Text>
		</AccordionContent>
	</AccordionItem>
</Accordion>
```

## Looks

```showcase-example
c-accordion-3
```

```showcase-example
c-accordion-5
```

## Rich triggers

```showcase-example
c-accordion-6
```

```showcase-example
c-accordion-9
```

## Nested

```showcase-example
c-accordion-8
```

## API Reference

```showcase-api

```

## Accessibility

- Each trigger is a button that says whether its section is expanded.
- Closed sections are not rendered.
- Leading and trailing parts are decorative: the label names the section.
