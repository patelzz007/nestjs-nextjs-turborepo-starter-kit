## When to use

- Media that must keep its shape while the width changes: photos, video, embeds, thumbnails

## When not to use

- Images with their own fixed ratio: use CoverImage
- Content whose height depends on its text

## Notes

- Sets the height from the width (`ratio` is width over height); the content fills it
- Pair with an Image (`resizeMode="cover"`) to crop a photo to the frame

## AspectRatio

`AspectRatio` keeps its content at a fixed width-to-height ratio as the screen's width changes.

### Features

- **Any ratio**: 16/9, 4/3, 1, 9/16 and the rest.
- **Fills its width**, with the height worked out from it.

## Integrating with other components

Wrap an Image, a video or a CoverImage; put it in a Card for a framed thumbnail.

## Frequently asked questions

### How do I crop a photo to the frame?

Put an `Image` with `resizeMode="cover"` and `className="size-full"` inside: the frame clips what does not fit.
