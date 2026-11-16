## When to use

- Card and screen headers with a photo that may be missing

## When not to use

- Avatars and logos: use Avatar
- A gallery: use ImageCarousel

## Notes

- Shows a loading shimmer until the image arrives, and the `fallback` when there is none or it fails

## CoverImage

`CoverImage` draws a photo at a fixed ratio, with a shimmer while it loads and a fallback when it is missing.

### Features

- **Ratios**: video, photo, square, portrait.
- **Fallback** content for a missing image.

## Integrating with other components

Head a Card with it; pair it with AspectRatio for other shapes.

## Frequently asked questions

### What shows while the image loads?

A shimmer in the frame's shape, so the layout never jumps.
