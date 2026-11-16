## Installation

The field parts ship with the kit in `packages/ui/src/components/field.tsx`; there is nothing to install.

```showcase-example
c-field-2
```

## Usage

```tsx
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@workspace/ui/components/field";
```

```tsx
<Field data-invalid={isInvalid}>
	<FieldLabel htmlFor="email">Email</FieldLabel>
	<Input id="email" type="email" aria-invalid={isInvalid} aria-describedby="email-hint email-error" />
	<FieldDescription id="email-hint">We never share it.</FieldDescription>
	<FieldError id="email-error" errors={errors} />
</Field>
```

## Anatomy

```tsx
<FieldSet>
	<FieldLegend />
	<FieldGroup>
		<Field>
			<FieldLabel />
			{/* the control */}
			<FieldDescription />
			<FieldError />
		</Field>
		<FieldSeparator />
		<Field orientation="horizontal">
			{/* a checkbox or switch */}
			<FieldContent>
				<FieldTitle />
				<FieldDescription />
			</FieldContent>
		</Field>
	</FieldGroup>
</FieldSet>
```

## Examples

### Choice rows

```showcase-example
c-field-4
```

### Responsive layout

```showcase-example
c-field-9
```

### Validation errors

```showcase-example
c-field-11
```

## API Reference

```showcase-api

```

## Accessibility

- `Field` renders `role="group"`; `FieldSet` is a native `fieldset` whose `FieldLegend` names it.
- `FieldLabel` is a native `label` — tie it to the control with `htmlFor`.
- `FieldError` renders `role="alert"`, so an error is announced as it appears. Link hints and errors to the control with `aria-describedby`.
