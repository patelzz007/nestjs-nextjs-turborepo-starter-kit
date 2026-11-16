## Installation

The autocomplete parts ship with the kit in `packages/ui/src/components/autocomplete.tsx`, built on Base UI's autocomplete; there is nothing to install.

```showcase-example
c-autocomplete-1
```

## Usage

```tsx
import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteItem, AutocompleteList } from "@workspace/ui/components/autocomplete";
```

```tsx
const FRUITS = ["Apple", "Banana", "Orange", "Grape"];

<Autocomplete items={FRUITS}>
	<AutocompleteInput aria-label="Fruit" placeholder="Search…" />
	<AutocompleteContent>
		<AutocompleteEmpty>No results found.</AutocompleteEmpty>
		<AutocompleteList>
			{(fruit: string) => (
				<AutocompleteItem key={fruit} value={fruit}>
					{fruit}
				</AutocompleteItem>
			)}
		</AutocompleteList>
	</AutocompleteContent>
</Autocomplete>;
```

## Anatomy

```tsx
<Autocomplete>
	<AutocompleteInput />
	<AutocompleteClear />
	<AutocompleteTrigger />
	<AutocompleteContent>
		<AutocompleteStatus />
		<AutocompleteEmpty />
		<AutocompleteList>
			<AutocompleteGroup>
				<AutocompleteGroupLabel />
				<AutocompleteCollection>{(item) => <AutocompleteItem />}</AutocompleteCollection>
			</AutocompleteGroup>
			<AutocompleteSeparator />
		</AutocompleteList>
	</AutocompleteContent>
</Autocomplete>
```

## Examples

### Auto highlight

```showcase-example
c-autocomplete-3
```

### Clear and trigger buttons

```showcase-example
c-autocomplete-7
```

### Groups

```showcase-example
c-autocomplete-8
```

### Async search

```showcase-example
c-autocomplete-9
```

### Form

```showcase-example
c-autocomplete-12
```

## API Reference

```showcase-api

```

## Keyboard

| Key          | Action                                            |
| :----------- | :------------------------------------------------ |
| `↓` `↑`      | Opens the list and moves the highlight.           |
| `Enter`      | Fills the input with the highlighted item.        |
| `Esc`        | Closes the list; a second press clears the input. |
| `Home` `End` | Moves the caret in the input.                     |

## Accessibility

- The input has `role="combobox"` and controls a `listbox`; the highlighted option is announced through `aria-activedescendant` while focus stays in the input.
- `AutocompleteStatus` is a live region for "searching" and result counts.
- Name the input with a label or `aria-label`; the clear and trigger buttons carry their own names.
