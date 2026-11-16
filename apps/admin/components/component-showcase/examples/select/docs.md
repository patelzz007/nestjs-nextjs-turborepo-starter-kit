## Installation

The select parts ship with the kit in `packages/ui/src/components/select.tsx`, built on Base UI's select; there is nothing to install.

```showcase-example
c-select-1
```

## Usage

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
```

```tsx
const SIZES = [
	{ label: "Small", value: "sm" },
	{ label: "Medium", value: "md" },
	{ label: "Large", value: "lg" },
];

<Select items={SIZES} value={size} onValueChange={setSize}>
	<SelectTrigger aria-label="Size">
		<SelectValue />
	</SelectTrigger>
	<SelectContent alignItemWithTrigger={false}>
		{SIZES.map((option) => (
			<SelectItem key={option.value} value={option.value}>
				{option.label}
			</SelectItem>
		))}
	</SelectContent>
</Select>;
```

## Anatomy

```tsx
<Select>
	<SelectTrigger>
		<SelectValue /> {/* or <SelectChips /> with multiple */}
		<SelectClear />
	</SelectTrigger>
	<SelectContent>
		<SelectScrollUpButton />
		<SelectGroup>
			<SelectLabel />
			<SelectItem />
		</SelectGroup>
		<SelectSeparator />
		<SelectEmpty />
		<SelectScrollDownButton />
	</SelectContent>
</Select>
```

## Examples

### Icons

```showcase-example
c-select-2
```

### Grouped labels

```showcase-example
c-select-3
```

### Multiple selection

```showcase-example
c-select-12
```

### Clear button

```showcase-example
c-select-21
```

### Option descriptions

```showcase-example
c-select-27
```

## API Reference

```showcase-api

```

## Keyboard

| Key                 | Action                                     |
| :------------------ | :----------------------------------------- |
| `Enter` `Space` `↓` | Opens the list.                            |
| `↑` `↓`             | Moves through the options.                 |
| A letter            | Jumps to the next option starting with it. |
| `Enter`             | Chooses the highlighted option.            |
| `Esc`               | Closes the list.                           |

## Accessibility

- The trigger is a combobox button that controls a listbox; each option has `aria-selected`.
- Name the trigger with a label tied to it, or `aria-label`.
- The clear and chip-remove affordances are pointer helpers; the keyboard clears through the list.
