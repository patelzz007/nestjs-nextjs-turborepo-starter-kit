## When to use

- Video, banner and screenshot slots in widescreen shapes such as 16:9, 21:9 and 16:10
- Photo and thumbnail slots in square, landscape or portrait shapes, cropped to fill the box
- Media boxes whose height follows their width, so the space is held before the image arrives

## When not to use

- Several images people swipe through: use [Carousel](/components/carousel) or [Image Carousel](/components/image-carousel)
- A cover photo with a loading surface and a fallback: use [Cover Image](/components/cover-image)

## Notes

- Pass `ratio` as width divided by height, e.g. `16 / 9`
- Set the width on a parent; the box takes its height from the ratio
- Write a real `alt` for every image

## Aspect Ratio: a box that keeps its shape

`AspectRatio` holds a fixed width-to-height ratio, so media takes its space before it loads and never shifts the layout. Put an image or a video inside, cropped with `object-cover`.

### What is Aspect Ratio?

A wrapper that sizes its height from its width: 16:9 for video, 1:1 for avatars and thumbnails, 4:5 for portrait posts.

### Why use Aspect Ratio?

Images without a reserved size push content down as they load. A ratio box holds the space from the first paint.

### Aspect Ratio features

- **Any ratio.** `ratio={16 / 9}`.
- **Any content.** Images, videos, iframes, placeholders.

## Integrating with other components

Use it inside [Card](/components/card)s for media, in [Carousel](/components/carousel) slides and in [Hover Card](/components/hover-card) previews.

## Frequently asked questions

### How do I crop the image?

Give the image `className="size-full object-cover"` inside the box.

### Is it accessible?

It is a layout box; the image inside needs a meaningful `alt`.
