## Installation

`ButtonGroup`, `ButtonGroupText` and `ButtonGroupSeparator` ship with the kit in `packages/ui/src/components/button-group.tsx`; there is nothing to install.

```showcase-example
c-button-group-1
```

## Usage

```tsx
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@workspace/ui/components/button-group";
```

```tsx
<ButtonGroup aria-label="Text formatting">
	<Button variant="outline">Bold</Button>
	<Button variant="outline">Italic</Button>
	<ButtonGroupSeparator />
	<ButtonGroupText>3 selected</ButtonGroupText>
</ButtonGroup>
```

## Anatomy

```tsx
<ButtonGroup>
	<Button />
	<ButtonGroupSeparator />
	<ButtonGroupText />
	<ButtonGroup /> {/* a nested cluster, set apart by a gap */}
</ButtonGroup>
```

Only direct children that carry a `data-slot` join at the seams. Every kit control has one; wrap your own markup in `ButtonGroupText`.

## Examples

### Split button

```showcase-example
c-button-group-4
```

### Inputs and selects

```showcase-example
c-button-group-2
```

### Vertical

```showcase-example
c-button-group-13
```

### Nested groups

```showcase-example
c-button-group-9
```

## API Reference

```showcase-api

```

## Accessibility

- `ButtonGroup` renders `role="group"`. Name it with `aria-label` (or `aria-labelledby`) so screen readers announce what the controls are for.
- Each control keeps its own tab stop; the group adds no roving focus. When the set is one choice made with the arrow keys, use [Toggle Group](/components/toggle-group).
