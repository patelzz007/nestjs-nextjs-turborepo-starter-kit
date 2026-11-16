## Installation

`Cascader` and `CascaderPanel` ship with the kit in `packages/ui-native/src/components/cascader.tsx`, with the tree logic in `lib/cascader.ts`; there is nothing to install.

```showcase-example
c-cascader-1
```

## Usage

```tsx
import { Cascader } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
```

```tsx
const PLACES: readonly CascaderNode[] = [{ value: "fr", label: "France", children: [{ value: "par", label: "Paris" }] }];

const [value, setValue] = React.useState<string | null>(null);

<Cascader label="Office" items={PLACES} value={value} onChange={setValue} />;
```

## Search

```showcase-example
c-cascader-3
```

```showcase-example
c-cascader-21
```

## Several at once

```showcase-example
c-cascader-2
```

```showcase-example
c-cascader-18
```

## Layouts

```showcase-example
c-cascader-13
```

```showcase-example
c-cascader-14
```

```showcase-example
c-cascader-7
```

## Loading on demand

```showcase-example
c-cascader-15
```

## Rows and the field

```showcase-example
c-cascader-5
```

```showcase-example
c-cascader-6
```

## API Reference

```showcase-api

```

## Accessibility

- The field is a combobox named by its label and the picked path.
- Pickable rows are radios (checkboxes when several can be picked), with a mixed state for a partly ticked branch.
- A branch that only opens is a button; a branch that can also be picked has its own "Open …" (or "Expand …" / "Collapse …") button.
- Search hits read their path as a hint; the open level's breadcrumb is a header, with a Back button.
- A level that fails to load shows an alert and a Retry button.
