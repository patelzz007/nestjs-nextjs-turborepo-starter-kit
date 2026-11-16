## Installation

The carousel parts ship with the kit in `packages/ui/src/components/carousel.tsx`, built on `embla-carousel-react`, already installed.

```showcase-example
c-carousel-1
```

## Usage

```tsx
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel";
```

```tsx
<Carousel className="w-full max-w-sm">
	<CarouselContent>
		{slides.map((slide) => (
			<CarouselItem key={slide.id}>{/* the slide */}</CarouselItem>
		))}
	</CarouselContent>
	<CarouselPrevious />
	<CarouselNext />
</Carousel>
```

## Examples

### Several items

```showcase-example
c-carousel-3
```

### Autoplay

```showcase-example
c-carousel-5
```

### Thumbnail strip

```showcase-example
c-carousel-9
```

### Dots

```showcase-example
c-carousel-11
```

## API Reference

```showcase-api

```

## Keyboard

| Key     | Action                                                               |
| :------ | :------------------------------------------------------------------- |
| `←` `→` | Moves to the previous or next slide, while focus is in the carousel. |

## Accessibility

- A labelled region with slides grouped as slides; the buttons are named and disable at the ends (unless looping).
- Autoplay must pause on hover and focus, and be stoppable.
