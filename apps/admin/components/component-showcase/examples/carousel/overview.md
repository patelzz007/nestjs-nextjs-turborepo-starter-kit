## When to use

- Photo galleries and featured slides shown one at a time, moved by swipe, arrow buttons or a timer
- Rows or columns of cards with several in view, sized per breakpoint or peeking at the next one
- Media viewers where a thumbnail strip or a row of dots tracks the current slide

## When not to use

- A gallery of same-shaped images with buttons, a counter and dots ready-made: use [Image Carousel](/components/image-carousel)
- Content people must compare side by side: show it all at once in a grid

## Notes

- `CarouselPrevious` and `CarouselNext` sit outside the slides at either end: leave room, or move them with `className`
- The carousel reacts to the left and right arrow keys while focus is inside it
- Use `useCarousel` (inside the carousel) to build dots, counters and thumbnail strips

## Carousel: slides that scroll

`Carousel` is a swipeable track of slides built on Embla: `CarouselContent` holds `CarouselItem`s, and `CarouselPrevious` / `CarouselNext` move between them. Options and plugins (autoplay, loop, alignment) come straight from Embla.

### What is Carousel?

A horizontal (or vertical) row of slides that scrolls one or several at a time, by drag, swipe, buttons or keys.

### Why use Carousel?

When there is more to show than fits — featured items, a gallery, onboarding cards — a carousel keeps it in one row and lets people move at their own pace.

### Carousel features

- **Horizontal or vertical.** `orientation`.
- **Several per view.** Item `basis` per breakpoint.
- **Embla options and plugins.** Loop, alignment, autoplay.
- **API access.** `setApi` and `useCarousel` for dots, counters and thumbnails.

## Integrating with other components

Put [Card](/components/card)s in slides, [Aspect Ratio](/components/aspect-ratio) images inside them, and build a thumbnail strip from `useCarousel`.

## Frequently asked questions

### How do I show several slides at once?

Give items a basis: `className="basis-1/3"` (or responsive `md:basis-1/2`).

### How do I autoplay?

Pass Embla's autoplay plugin in `plugins`, and pause it on hover and focus.

### Is it accessible?

The region is labelled as a carousel, slides are grouped as slides, the buttons are named, and the arrow keys move between slides. Avoid autoplay that cannot be paused.
