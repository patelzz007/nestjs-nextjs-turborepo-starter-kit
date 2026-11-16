## Installation

The number field parts ship with the kit in `packages/ui/src/components/number-field.tsx`; there is nothing to install. They are built on Base UI's number field.

```showcase-example
c-number-field-1
```

## Usage

```tsx
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput, NumberFieldScrubArea } from "@workspace/ui/components/number-field";
```

```tsx
<NumberField defaultValue={1} min={1} max={99}>
	<NumberFieldScrubArea label="Quantity" />
	<NumberFieldGroup>
		<NumberFieldDecrement />
		<NumberFieldInput />
		<NumberFieldIncrement />
	</NumberFieldGroup>
</NumberField>
```

## Anatomy

```tsx
<NumberField>
	<NumberFieldScrubArea /> {/* optional: a label that scrubs the value when dragged */}
	<NumberFieldGroup>
		<NumberFieldDecrement />
		<NumberFieldInput />
		<NumberFieldIncrement />
	</NumberFieldGroup>
</NumberField>
```

`size` on `NumberField` sets the height of every part.

## Examples

### Sizes

```showcase-example
c-number-field-2
```

```showcase-example
c-number-field-3
```

### Buttons on the right

```showcase-example
c-number-field-4
```

### Spinner buttons

```showcase-example
c-number-field-5
```

### Form validation

```showcase-example
c-number-field-6
```

## API Reference

```showcase-api

```

## Keyboard

| Key               | Action                             |
| :---------------- | :--------------------------------- |
| `↑` `↓`           | Steps the value by `step`.         |
| `Shift` + `↑` `↓` | Steps by `largeStep`.              |
| `Alt` + `↑` `↓`   | Steps by `smallStep`.              |
| `Home` `End`      | Jumps to `min` or `max`, when set. |

## Accessibility

- The input has `role="spinbutton"` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`.
- The increment and decrement buttons are named, and disable at a bound.
- Name the field with a label pointing at the `id` given to `NumberField`.
