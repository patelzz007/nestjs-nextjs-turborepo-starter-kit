## Installation

`Combobox` and `MultiCombobox` ship with the kit in `packages/ui-native/src/components/combobox.tsx`; there is nothing to install.

```showcase-example
c-combobox-1
```

## Usage

```tsx
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
```

```tsx
const FRAMEWORKS: readonly ComboboxOption<string>[] = [
	{ value: "next", label: "Next.js" },
	{ value: "remix", label: "Remix" },
];

const [value, setValue] = React.useState<string | null>(null);

<Combobox label="Framework" options={FRAMEWORKS} value={value} onChange={setValue} placeholder="Select a framework" />;
```

## Search

The search filters on each option's label and description. With `autoHighlight`, the first match is tinted and the Return key picks it.

```showcase-example
c-combobox-5
```

```showcase-example
c-combobox-8
```

## Groups

```showcase-example
c-combobox-6
```

```showcase-example
c-combobox-7
```

## Several at once

```showcase-example
c-combobox-12
```

```showcase-example
c-combobox-15
```

```showcase-example
c-combobox-24
```

## Rich rows

```showcase-example
c-combobox-16
```

```showcase-example
c-combobox-21
```

## States

```showcase-example
c-combobox-3
```

```showcase-example
c-combobox-2
```

## API Reference

```showcase-api

```

## Accessibility

- The field is a combobox named by its label and the chosen option; its hint says it opens a search.
- The search box is named "Search <label>" and is focused as the sheet opens.
- Rows are radio rows (checkbox rows in `MultiCombobox`) that say whether they are chosen.
- Glyphs, dots and avatars before a row are decorative: the label names the option.
- Each chip's remove button and the clear button are their own named buttons.
