## Installation

`Skeleton` ships with the kit in `packages/ui/src/components/skeleton.tsx`, and `SkeletonRegion` in `packages/ui/src/components/skeleton-region.tsx`; there is nothing to install.

```showcase-example
c-skeleton-1
```

## Usage

```tsx
import { Skeleton } from "@workspace/ui/components/skeleton";
```

```tsx
<div className="flex items-center gap-3">
	<Skeleton variant="circular" className="size-10" />
	<div className="flex flex-col gap-2">
		<Skeleton variant="text" className="h-4 w-40" />
		<Skeleton variant="text" className="h-3 w-24" />
	</div>
</div>
```

## Examples

### Card

```showcase-example
c-skeleton-2
```

### Data table

```showcase-example
c-skeleton-5
```

### Profile page

```showcase-example
c-skeleton-9
```

## API Reference

```showcase-api

```

## Accessibility

- Skeletons are hidden from assistive technology; announce the load from the region (`SkeletonRegion`, or `aria-busy`).
- The shimmer stays still under `prefers-reduced-motion`.
