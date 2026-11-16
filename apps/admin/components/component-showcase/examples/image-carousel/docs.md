## Installation

`ImageCarousel` ships with the kit in `packages/ui/src/components/image-carousel.tsx`; there is nothing to install.

```showcase-example
c-image-carousel-1
```

## Usage

```tsx
import { ImageCarousel } from "@workspace/ui/components/image-carousel";
```

```tsx
<ImageCarousel images={listing.photos} ratio={4 / 3} onSelectedIndexChange={setPhotoIndex} />
```

## API Reference

```showcase-api

```

## Accessibility

- Buttons and dots are named from the `imageCarousel` labels; each image needs its `alt`.
