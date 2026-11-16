## Installation

`Carousel` ships with the kit in `packages/ui-native/src/components/carousel.tsx`; there is nothing to install.

```showcase-example
c-carousel-1
```

## Usage

```tsx
import { Carousel } from "@workspace/ui-native/components/carousel";
```

```tsx
<Carousel index={index} onChange={setIndex} showControls>
	{slides}
</Carousel>
```

## Layouts

```showcase-example
c-carousel-2
```

```showcase-example
c-carousel-3
```

```showcase-example
c-carousel-4
```

```showcase-example
c-carousel-6
```

```showcase-example
c-carousel-7
```

## Motion

```showcase-example
c-carousel-5
```

## Overlays

```showcase-example
c-carousel-8
```

```showcase-example
c-carousel-11
```

## Thumbnails

```showcase-example
c-carousel-9
```

```showcase-example
c-carousel-10
```

## API Reference

```showcase-api

```

## Accessibility

- Each dot is a button named "Slide n of total", the shown one selected.
- Only the slides in view are read by screen readers.
- Arrows are named buttons, disabled at the ends unless the carousel loops.
