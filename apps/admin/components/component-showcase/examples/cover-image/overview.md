## When to use

- Card and page headers with a cover photo in a fixed shape
- Covers that may be missing, showing a designed fallback instead of a broken image

## When not to use

- Several images in a row people swipe: use [Image Carousel](/components/image-carousel)
- A plain ratio box for any content: use [Aspect Ratio](/components/aspect-ratio)

## Notes

- `src={null}` (or a failed load) shows `fallback`, or a muted surface without one
- Pass `priority` for an above-the-fold cover, and `sizes` for responsive images

## Cover Image: a cropped cover with a fallback

`CoverImage` shows an image cropped to a fixed aspect ratio. It fills its frame, shows a muted surface while loading, and swaps in a fallback when there is no image or it fails to load.

### What is Cover Image?

The header image of a merchant, a campaign or a product card — stateless for its caller: give it a source, an alt and a ratio.

### Why use Cover Image?

Covers fail and go missing. Handling loading and fallback in one component means no screen ever shows a broken-image icon.

### Cover Image features

- **Fixed ratio.** Cropped with `object-cover`.
- **Loading surface and fallback.**
- **Responsive.** `sources`, `sizes` and `priority`.

## Integrating with other components

Use it at the top of a [Card](/components/card), in [Item](/components/item) media, and as the single-image case of [Image Carousel](/components/image-carousel), which uses it.

## Frequently asked questions

### What shows when there is no image?

The `fallback` you pass (an icon, a pattern), or a muted surface.

### Is it accessible?

It is an image with your `alt`; decorative covers can take `alt=""`.
