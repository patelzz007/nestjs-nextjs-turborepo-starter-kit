## Installation

`Skeleton` ships with the kit in `packages/ui-native/src/components/skeleton.tsx`; there is nothing to install.

```showcase-example
c-skeleton-1
```

## Usage

```tsx
import { Skeleton, SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
```

```tsx
<SkeletonGroup accessibilityLabel="Loading profile">
	<Skeleton className="size-12 rounded-full" />
	<SkeletonText size="base" widthClassName="w-40" />
</SkeletonGroup>
```

## Cards

```showcase-example
c-skeleton-2
```

```showcase-example
c-skeleton-8
```

## Lists and tables

```showcase-example
c-skeleton-5
```

```showcase-example
c-skeleton-7
```

## Whole screens

```showcase-example
c-skeleton-9
```

```showcase-example
c-skeleton-10
```

## API Reference

```showcase-api

```

## Accessibility

- A named group is one busy progress bar for screen readers; the bones themselves are hidden.
- The sweep stops under Reduce Motion.
