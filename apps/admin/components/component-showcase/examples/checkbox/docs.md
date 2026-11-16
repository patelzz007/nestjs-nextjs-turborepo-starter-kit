## Installation

`Checkbox` ships with the kit in `packages/ui/src/components/checkbox.tsx`, built on Base UI's checkbox; there is nothing to install.

```showcase-example
c-checkbox-1
```

## Usage

```tsx
import { Checkbox } from "@workspace/ui/components/checkbox";
```

```tsx
<div className="flex items-center gap-2">
	<Checkbox id="terms" name="terms" checked={accepted} onCheckedChange={setAccepted} />
	<Label htmlFor="terms">Accept the terms</Label>
</div>
```

## Examples

### Indeterminate

```showcase-example
c-checkbox-4
```

### Label and description

```showcase-example
c-checkbox-5
```

### Group

```showcase-example
c-checkbox-8
```

### Setting card

```showcase-example
c-checkbox-9
```

### Nested permissions

```showcase-example
c-checkbox-16
```

## API Reference

```showcase-api

```

## Keyboard

| Key     | Action                |
| :------ | :-------------------- |
| `Space` | Toggles the checkbox. |

## Accessibility

- It renders `role="checkbox"` with `aria-checked` of `true`, `false` or `mixed`, plus a hidden native input for forms.
- Name it with a `Label` tied by `htmlFor`, or wrap both in the label.
