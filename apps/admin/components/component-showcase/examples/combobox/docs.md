## Installation

The combobox parts ship with the kit in `packages/ui/src/components/combobox.tsx`, built on Base UI's combobox; there is nothing to install.

```showcase-example
c-combobox-1
```

## Usage

```tsx
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
```

```tsx
const FRAMEWORKS = ["Next.js", "Remix", "Astro"];

<Combobox items={FRAMEWORKS} value={framework} onValueChange={setFramework}>
	<ComboboxInput aria-label="Framework" placeholder="Select a framework" />
	<ComboboxContent>
		<ComboboxEmpty text="No framework found." />
		<ComboboxList>
			<ComboboxCollection>
				{(item: string) => (
					<ComboboxItem key={item} value={item}>
						{item}
					</ComboboxItem>
				)}
			</ComboboxCollection>
		</ComboboxList>
	</ComboboxContent>
</Combobox>;
```

## Multiple selection

```tsx
const anchor = useComboboxAnchor();

<Combobox multiple items={FRAMEWORKS} value={frameworks} onValueChange={setFrameworks}>
	<ComboboxChips ref={anchor}>
		{frameworks.map((item) => (
			<ComboboxChip key={item}>{item}</ComboboxChip>
		))}
		<ComboboxChipsInput placeholder="Add a framework…" />
	</ComboboxChips>
	<ComboboxContent anchor={anchor}>{/* … */}</ComboboxContent>
</Combobox>;
```

```showcase-example
c-combobox-12
```

## Examples

### Grouped options

```showcase-example
c-combobox-6
```

### Country picker

```showcase-example
c-combobox-10
```

### In a form

```showcase-example
c-combobox-11
```

### Property picker

```showcase-example
c-combobox-21
```

## API Reference

```showcase-api

```

## Keyboard

| Key         | Action                                                        |
| :---------- | :------------------------------------------------------------ |
| Typing      | Filters the options.                                          |
| `↓` `↑`     | Opens the list and moves the highlight.                       |
| `Enter`     | Picks the highlighted option.                                 |
| `Backspace` | In multiple mode, with an empty input, removes the last chip. |
| `Esc`       | Closes the list.                                              |

## Accessibility

- The input has `role="combobox"` and controls a `listbox`; the highlighted option is exposed through `aria-activedescendant`.
- Name it with a label or `ariaLabel`; chips have named remove buttons.
