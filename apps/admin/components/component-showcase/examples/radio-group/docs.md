## Installation

`RadioGroup` and `RadioGroupItem` ship with the kit in `packages/ui/src/components/radio-group.tsx`, built on Base UI's radio group; there is nothing to install.

```showcase-example
c-radio-group-1
```

## Usage

```tsx
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
```

```tsx
<RadioGroup name="density" value={density} onValueChange={setDensity} aria-labelledby="density-label">
	<div className="flex items-center gap-2">
		<RadioGroupItem id="comfortable" value="comfortable" />
		<Label htmlFor="comfortable">Comfortable</Label>
	</div>
	<div className="flex items-center gap-2">
		<RadioGroupItem id="compact" value="compact" />
		<Label htmlFor="compact">Compact</Label>
	</div>
</RadioGroup>
```

## Examples

### Descriptions

```showcase-example
c-radio-group-3
```

### Legend and description

```showcase-example
c-radio-group-6
```

### Descriptive cards

```showcase-example
c-radio-group-7
```

### Pricing tiers

```showcase-example
c-radio-group-17
```

## API Reference

```showcase-api

```

## Keyboard

| Key               | Action                                                          |
| :---------------- | :-------------------------------------------------------------- |
| `Tab`             | Moves focus into the group, to the checked option or the first. |
| `↑` `↓` / `←` `→` | Moves to and checks the next or previous option.                |
| `Space`           | Checks the focused option.                                      |

## Accessibility

- The group has `role="radiogroup"`; name it with `aria-labelledby` (or a `FieldLegend`). Each item is a `radio` with `aria-checked`.
- Focus roves inside the group, so it is a single tab stop.
