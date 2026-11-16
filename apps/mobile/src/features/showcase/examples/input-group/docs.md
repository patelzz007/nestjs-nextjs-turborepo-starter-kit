## Installation

`InputGroup` ships with the kit in `packages/ui-native/src/components/input-group.tsx`; there is nothing to install.

```showcase-example
c-input-group-4
```

## Usage

```tsx
import { InputGroup } from "@workspace/ui-native/components/input-group";
```

```tsx
<InputGroup value={query} onChange={setQuery} leadingIcon={SearchIcon} accessibilityLabel="Search" />
```

## Addons

Glyphs and texts before or after.

```showcase-example
c-input-group-4
```

```showcase-example
c-input-group-9
```

## Actions

A button, a copy or a menu inside the field.

```showcase-example
c-input-group-11
```

```showcase-example
c-input-group-12
```

## Rows

A toolbar or a count inside the border.

```showcase-example
c-input-group-18
```

```showcase-example
c-input-group-17
```

## API Reference

```showcase-api

```

## Accessibility

- Addon texts and glyphs are hidden from screen readers; the field keeps its label.
- Each button inside has its own label.
- With rows, the border carries the field's error state.
