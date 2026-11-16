## Installation

`Filters` ships with the kit in `packages/ui-native/src/components/filters.tsx`; there is nothing to install.

```showcase-example
c-filters-1
```

## Usage

```tsx
import { Filters } from "@workspace/ui-native/components/filters";
```

```tsx
<Filters fields={fields} query={query} onQueryChange={setQuery} />
```

## Fields at scale

```showcase-example
c-filters-2
```

## Options

```showcase-example
c-filters-3
```

```showcase-example
c-filters-4
```

## Custom editors

```showcase-example
c-filters-5
```

```showcase-example
c-filters-6
```

```showcase-example
c-filters-8
```

```showcase-example
c-filters-9
```

## Filtering data

```showcase-example
c-filters-7
```

## Builder

```showcase-example
c-filters-10
```

```showcase-example
c-filters-11
```

## Controlled and translated

```showcase-example
c-filters-12
```

## API Reference

```showcase-api

```

## Accessibility

- Each chip is a button that reads its field, operator and value; its remove button names the field.
- Field search, operators and values live in a bottom sheet, a modal screen readers stay inside.
- A value that is not accepted says why, next to the field, before it is applied.
