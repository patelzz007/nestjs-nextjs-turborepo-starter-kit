## Installation

`Pagination` ships with the kit in `packages/ui-native/src/components/pagination.tsx`; there is nothing to install.

```showcase-example
c-pagination-8
```

## Usage

```tsx
import { Pagination } from "@workspace/ui-native/components/pagination";
```

```tsx
<Pagination page={page} pageCount={10} onChange={setPage} />
```

## Numbered pages

```showcase-example
c-pagination-1
```

```showcase-example
c-pagination-6
```

```showcase-example
c-pagination-11
```

## Footers

```showcase-example
c-pagination-12
```

```showcase-example
c-pagination-15
```

## API Reference

```showcase-api

```

## Accessibility

- The row is a toolbar named "Pagination", and says when it is busy.
- Page buttons are named "Page 6" and say which is selected; ellipses are hidden.
- The page info is a polite live region, so changes are announced.
