## Installation

The pagination parts ship with the kit in `packages/ui/src/components/pagination.tsx`; there is nothing to install. Previous and Next take their labels from the `pagination` messages.

```showcase-example
c-pagination-1
```

## Usage

```tsx
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@workspace/ui/components/pagination";
```

```tsx
<Pagination>
	<PaginationContent>
		<PaginationItem>
			<PaginationPrevious href="?page=3" />
		</PaginationItem>
		<PaginationItem>
			<PaginationLink href="?page=4" isActive>
				4
			</PaginationLink>
		</PaginationItem>
		<PaginationItem>
			<PaginationEllipsis />
		</PaginationItem>
		<PaginationItem>
			<PaginationNext href="?page=5" />
		</PaginationItem>
	</PaginationContent>
</Pagination>
```

## Examples

### Compact go-to

```showcase-example
c-pagination-5
```

### Rows per page

```showcase-example
c-pagination-12
```

### Info and per-page

```showcase-example
c-pagination-15
```

## API Reference

```showcase-api

```

## Accessibility

- A `nav` named for pagination; the current page link carries `aria-current="page"`.
- The ellipsis is hidden from assistive technology with a text alternative.
