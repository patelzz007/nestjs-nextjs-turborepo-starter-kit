## When to use

- Product, listing and merchant photos: same-shaped images people swipe through
- Galleries that need buttons, a position counter and dots without composing them

## When not to use

- Slides of mixed content, or several per view: use [Carousel](/components/carousel)
- A single image: [Cover Image](/components/cover-image) (which this uses when there is only one)

## Notes

- One image renders as a plain `CoverImage`; several get previous and next buttons, a counter and a dot each
- It loops one way: after the last image the first slides in from the right
- `onSelectedIndexChange` reports the image in view

## Image Carousel: a ready-made photo gallery

`ImageCarousel` is a swipeable gallery of same-shaped images, built on the kit's `Carousel` and `CoverImage`. It adds everything a photo gallery needs — buttons, a "2 / 5" counter, dots, a ratio and responsive images — in one component.

### What is Image Carousel?

A gallery from an array of images: give it `images` and a `ratio`, and it handles swiping, keyboard, counter, dots and loading.

### Why use Image Carousel?

Product and listing galleries are everywhere, and each needs the same controls. One component keeps them consistent and accessible.

### Image Carousel features

- **Buttons, counter and dots.**
- **One-image fallback.** A plain cover when there is only one.
- **Responsive images.** `sizes`, `priority`.
- **Localised controls.** From the `imageCarousel` labels.

## Integrating with other components

Put it at the top of a [Card](/components/card) for a listing, and pair it with a thumbnail strip built from [Carousel](/components/carousel) when needed.

## Frequently asked questions

### Can I start on a given image?

Yes: `startIndex`.

### Is it accessible?

Buttons and dots are named from the `imageCarousel` labels, the counter is text, and the arrow keys move between images.
