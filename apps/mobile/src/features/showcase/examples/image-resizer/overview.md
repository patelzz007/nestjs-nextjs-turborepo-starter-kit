## When to use

- Sizing a picture inside rich text or an email layout

## When not to use

- Cropping a photo: use an image editor

## Notes

- Corner handles drag the size; `aspectRatio` keeps the shape
- Screen readers step the size with the adjust gesture

## ImageResizer

`ImageResizer` sizes a picture by dragging its corner handles, keeping its ratio, and reports its width and height.

### Features

- **Kept ratio** or free corners.
- **Limits**: smallest and largest size.
- **Accessible**: an adjustable control per handle.

## Integrating with other components

Use it in an editor; save the size the caller receives in `onChangeEnd`.

## Frequently asked questions

### Can screen readers resize it?

Yes: each handle is adjustable; swipe up or down to grow or shrink by a step.
