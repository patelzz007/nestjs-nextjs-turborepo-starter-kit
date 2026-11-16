## Installation

`CoverImage` ships with the kit in `packages/ui/src/components/cover-image.tsx`; there is nothing to install.

```showcase-example
c-cover-image-1
```

## Usage

```tsx
import { CoverImage } from "@workspace/ui/components/cover-image";
```

```tsx
<CoverImage src={merchant.coverUrl} alt={`${merchant.name} storefront`} ratio={16 / 9} fallback={<ImageOff aria-hidden="true" />} />
```

## API Reference

```showcase-api

```

## Accessibility

- An image with your `alt`; use `alt=""` for a purely decorative cover.
