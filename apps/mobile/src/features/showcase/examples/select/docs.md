## Installation

`SelectField` and `MultiSelectField` ship with the kit in `packages/ui-native/src/components/select-field.tsx`; there is nothing to install.

```showcase-example
c-select-1
```

## Usage

```tsx
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
```

```tsx
const FRUITS: readonly SelectOption<string>[] = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
];

const [value, setValue] = React.useState<string | null>(null);

<SelectField label="Fruit" options={FRUITS} value={value} onChange={setValue} placeholder="Select a fruit" />;
```

## Rich options

An option's `description`, `leading` and `trailing` parts show in its row; the chosen option's `leading` part shows in the field too.

```showcase-example
c-select-2
```

```showcase-example
c-select-18
```

```showcase-example
c-select-28
```

## Groups

Options with a `group` are listed under its heading, in the order the groups first appear.

```showcase-example
c-select-3
```

```showcase-example
c-select-24
```

## The field

A prefix, a custom drawing of the value, another chevron and a clear button.

```showcase-example
c-select-19
```

```showcase-example
c-select-21
```

## Several at once

`MultiSelectField` takes `values` and reports the new list; its sheet stays open while options are ticked.

```showcase-example
c-select-12
```

```showcase-example
c-select-23
```

## States

```showcase-example
c-select-9
```

```showcase-example
c-select-10
```

## API Reference

```showcase-api

```

## Accessibility

- The field is a combobox named by its label and the chosen option ("Fruit, Apple"), and says whether its sheet is open.
- Each option is a radio row (a checkbox row in `MultiSelectField`) that says whether it is chosen and whether it is disabled.
- Group headings are headers, so screen reader users can jump between groups.
- `leading` and `trailing` parts are decorative: the label names the option, so never put meaning only in a dot's colour.
- The clear button and each chip's remove button are their own 44 pt buttons, named "Clear fruit" and "Remove Apple".
- An error message is announced as it appears.
