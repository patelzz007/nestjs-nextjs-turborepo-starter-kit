## Installation

The input group parts ship with the kit in `packages/ui/src/components/input-group.tsx`; there is nothing to install.

```showcase-example
c-input-group-1
```

## Usage

```tsx
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";
```

```tsx
<InputGroup>
	<InputGroupAddon>
		<SearchIcon aria-hidden="true" />
	</InputGroupAddon>
	<InputGroupInput aria-label="Search" placeholder="Search…" />
	<InputGroupAddon align="inline-end">
		<InputGroupButton aria-label="Clear search" size="icon-xs">
			<XIcon aria-hidden="true" />
		</InputGroupButton>
	</InputGroupAddon>
</InputGroup>
```

## Anatomy

```tsx
<InputGroup>
	<InputGroupAddon align="inline-start | inline-end | block-start | block-end">
		<InputGroupText />
		<InputGroupButton />
	</InputGroupAddon>
	<InputGroupInput /> {/* or <InputGroupTextarea /> */}
</InputGroup>
```

## Examples

### Prefix and suffix text

```showcase-example
c-input-group-9
```

### Action button

```showcase-example
c-input-group-10
```

### Keyboard shortcut

```showcase-example
c-input-group-13
```

### Invalid

```showcase-example
c-input-group-3
```

## API Reference

```showcase-api

```

## Accessibility

- The control is a native `input` or `textarea`: name it with a label or `aria-label`; addon text does not name it.
- `InputGroupButton` defaults to `type="button"`; icon-only buttons need an `aria-label`.
- `aria-invalid` on the control styles the whole group and announces the error.
