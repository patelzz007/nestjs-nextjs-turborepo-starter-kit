## When to use

- Sizing a picture inside rich text, an email layout or a page builder by dragging its handles
- Any image whose display size people choose, within limits and an aspect ratio

## When not to use

- Cropping an image to a region: a cropper is a different tool
- Showing an image at a fixed size: use [Cover Image](/components/cover-image) or [Aspect Ratio](/components/aspect-ratio)

## Notes

- The value is `{ width, height }`; `onValueChange` fires while dragging and `onValueCommitted` once on release
- From the keyboard, focus a handle and use the arrow keys (Shift for larger steps)
- `aspectRatio` locks the shape; `minWidth`, `maxWidth`, `minHeight` and `maxHeight` bound it

## Image Resizer: drag to size an image

`ImageResizer` shows an image with handles on its corners and edges that resize it by drag — or, from the keyboard, by focusing a handle and pressing the arrow keys. It keeps the aspect ratio and the bounds you give it.

### What is Image Resizer?

A controlled component around an image: its value is the size, and the handles change it. It is the resize behaviour of an editor's image node, usable anywhere.

### Why use Image Resizer?

People size images by eye. Direct handles are faster than typing numbers, and keyboard support keeps it accessible.

### Image Resizer features

- **Corner and edge handles.** Choose which with `handles`.
- **Keyboard.** Arrow keys with `step` and `largeStep`.
- **Bounds and ratio.** Minimum, maximum and a locked aspect ratio.
- **Change and commit.** Live updates and a single commit on release.

## Integrating with other components

It sizes images inside the [Rich Text Editor](/components/rich-text-editor) and in layouts previewed with [Rich Text View](/components/rich-text-view).

## Frequently asked questions

### How do I save the size only once?

Use `onValueCommitted`, which fires on release (or after a key press), instead of `onValueChange`.

### Is it accessible?

Each handle is a focusable slider-like control named from the `imageResizer` labels, moved with the arrow keys.
