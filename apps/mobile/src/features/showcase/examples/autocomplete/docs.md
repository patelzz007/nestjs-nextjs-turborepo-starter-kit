## Installation

`Autocomplete` ships with the kit in `packages/ui-native/src/components/autocomplete.tsx`; there is nothing to install.

```showcase-example
c-autocomplete-1
```

## Usage

```tsx
import { Autocomplete } from "@workspace/ui-native/components/autocomplete";
```

```tsx
<Autocomplete value={tag} onChange={setTag} items={TAGS} accessibilityLabel="Tag" />
```

## Suggestions

Filtered and grouped.

```showcase-example
c-autocomplete-1
```

```showcase-example
c-autocomplete-8
```

## Buttons

Clear and open the list.

```showcase-example
c-autocomplete-7
```

## Server lookups

A status line while results arrive.

```showcase-example
c-autocomplete-9
```

## API Reference

```showcase-api

```

## Accessibility

- The status line is announced politely.
- Each suggestion is a button; the highlighted one is marked selected.
