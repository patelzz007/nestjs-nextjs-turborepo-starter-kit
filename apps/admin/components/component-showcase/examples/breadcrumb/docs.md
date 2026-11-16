## Installation

The breadcrumb parts ship with the kit in `packages/ui/src/components/breadcrumb.tsx`; there is nothing to install.

```showcase-example
c-breadcrumb-1
```

## Usage

```tsx
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
```

```tsx
<Breadcrumb>
	<BreadcrumbList>
		<BreadcrumbItem>
			<BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
		</BreadcrumbItem>
		<BreadcrumbSeparator />
		<BreadcrumbItem>
			<BreadcrumbLink render={<Link href="/merchants" />}>Merchants</BreadcrumbLink>
		</BreadcrumbItem>
		<BreadcrumbSeparator />
		<BreadcrumbItem>
			<BreadcrumbPage>Acme Coffee</BreadcrumbPage>
		</BreadcrumbItem>
	</BreadcrumbList>
</Breadcrumb>
```

## Examples

### Dropdown menu

```showcase-example
c-breadcrumb-2
```

### Router link

```showcase-example
c-breadcrumb-3
```

### Item icons

```showcase-example
c-breadcrumb-5
```

### Project and document

```showcase-example
c-breadcrumb-15
```

## API Reference

```showcase-api

```

## Accessibility

- A `nav` with `aria-label="breadcrumb"` and an ordered list; the current page has `aria-current="page"`.
- Separators and the ellipsis are hidden from assistive technology.
