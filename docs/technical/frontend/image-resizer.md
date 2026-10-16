---
title: "Image resizer"
tags: ["image", "ui", "mobile", "docs", "accessibility"]
description: "The drag-to-resize image: one geometry module in packages/shared, the web and native ImageResizer components, the admin and mobile gallery demos, and image-resize fences in the docs."
order: 28
author: "Platform Team"
lastUpdated: 1792195200000
coverImage: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1600&q=80"
---

# Image resizer

`ImageResizer` shows an image the user resizes by dragging handles on its corners and edges. It is
a dumb, controlled component: the caller owns the size, gets every new size while a handle moves,
and saves the size once the drag ends. Every platform has it — the web apps (web, admin, merchant),
the mobile app and this docs site — and all of them use **one geometry module**,
[`packages/shared/src/lib/image-resize/`](../../../packages/shared/src/lib/image-resize/index.ts)
([ADR 057](../../adr/057-cross-platform-image-resizer-and-carousel.md)).

```image-resize width="480" height="459"
![The welcome email](images/email/welcome.png)
```

The image above is an `image-resize` fence in this page's markdown. Drag a handle, or press Tab
until a handle has focus and use the arrow keys (see [In the docs](#in-the-docs)).

## The shared geometry

`@workspace/shared` exports pure functions with no DOM or React Native code. Each platform turns its
own input (pointer, touch, keyboard, screen reader) into a handle and a distance, and gets the next
size from the same functions:

| Export | What it does |
| --- | --- |
| `IMAGE_RESIZE_HANDLES`, `IMAGE_RESIZE_CORNER_HANDLES`, `ImageResizeHandleSchema` | The eight handles (`top-left` … `left`), the four corners, and the zod enum for them |
| `resolveImageResizeConstraints(input)` | Fills in the defaults: no side below `DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX` (48), no maximum, free aspect ratio. Bounds that no size can satisfy throw `InvalidImageResizeConstraintsError` |
| `resizeImageByHandle(start, handle, delta, constraints)` | The size after dragging `handle` by `delta` from the size at the start of the drag |
| `nudgeImageSize(size, handle, distance, constraints)` | Moves a handle straight out (or in, for a negative distance). This is one screen-reader step |
| `clampImageSize(size, constraints)` | The closest size within the bounds, in whole pixels |
| `isSameImageSize(a, b)` | Lets a renderer report only real changes |

The rules:

- **A handle never moves the image.** The image stays anchored at its top-left corner. Dragging a
  handle away from the image grows it, and dragging it towards the image shrinks it. The `left`
  handle dragged left grows the width. The `right` handle dragged left shrinks it.
- **Each new size comes from the size at the start of the drag.** Moves are never added up one by
  one, so rounding does not drift.
- **With an aspect ratio**, an edge handle drives its own side. A corner follows whichever side the
  pointer stretched further. The ratio is clamped too: the width stays within what both the width
  and the height bounds allow at that ratio. If no width fits both, the minimum wins.
- Sizes are whole layout pixels: CSS pixels on the web, points on mobile.

## Web — `@workspace/ui`

```tsx
import { ImageResizer } from "@workspace/ui/components/image-resizer";

const [size, setSize] = React.useState<ImageSize>({ width: 480, height: 270 });

<ImageResizer
	src={photo.url}
	alt={photo.description}
	value={size}
	onValueChange={setSize}
	onValueCommitted={saveSize} // once per drag or arrow-key step
	maxWidth={columnWidth}
	aspectRatio={photo.width / photo.height} // omit to let the sides change independently
/>;
```

- **Pointer:** each handle captures the pointer. Moves report `onValueChange`, and releasing the
  pointer reports `onValueCommitted` (only when the size changed). **Escape** during a drag cancels
  it and goes back to the starting size.
- **Keyboard:** handles are buttons named from the `imageResizer` label family ("Resize from the
  bottom-right corner"). The arrow keys move the focused handle by `step` (10 px), or by
  `largeStep` (50 px) with Shift. Each step is committed and announced through a polite live
  region ("490 by 276 pixels").
- **Props:** `handles` (default all eight), `minWidth` / `minHeight` / `maxWidth` / `maxHeight`,
  `variant` (`outline`, or `ghost`, which shows the frame and handles only on hover or focus, and
  always on touch screens), `size` (`sm` / `md` handle), `fit` (`cover` / `contain` / `fill`),
  `disabled` (no handles), `fallback` (shown when the image fails to load) and `labels`. Every
  handle's hit area is at least 24 px (WCAG 2.5.8).

The admin's `/components/image-resizer` page shows it live.

## Mobile — `@workspace/ui-native`

```tsx
import { ImageResizer } from "@workspace/ui-native/components/image-resizer";

<ImageResizer uri={photo.uri} alt={photo.description} value={size} onChange={setSize} onChangeEnd={saveSize} maxWidth={contentWidth} aspectRatio={1} />;
```

- Gestures use React Native's own responder system, the same one `Slider` uses. No gesture library
  is needed. A handle keeps the touch once it has it, so a parent `ScrollView` does not take over
  mid-drag.
- Every handle has a 44 pt touch area (rules/04). Half of it lies outside the picture, so leave
  about 24 pt of room around the resizer.
- Screen readers hear each handle as an **adjustable** control named by `handleLabel`. Its value is
  `sizeText` ("200 by 150 points"). Swiping up grows the picture from that handle, and swiping down
  shrinks it, by `step`.
- `variant` is `outline` or `plain`, `size` is `sm` or `md`, and `fit` is `cover`, `contain` or
  `fill` (passed to expo-image's `contentFit`). A missing or broken picture shows the kit's
  placeholder.

See it under **Settings → Components → Media**.

## In the docs

An ```` ```image-resize ```` fence takes exactly one image line, plus its starting size in whole CSS
pixels:

````md
```image-resize width="480" height="459"
![The welcome email](images/email/welcome.png)
```
````

The image keeps the shape of `width` × `height` while it is resized. Add `aspect="free"` to let the
sides change independently. The build renders the web `ImageResizer` to HTML, so the image shows
before any JavaScript runs. On pages that have one, the browser hydrates it into the live component
(`apps/docs/src/lib/media/`, `src/scripts/media-islands.ts`). The image never grows wider than the
column, and on a narrow screen it shrinks to fit. A malformed fence fails the build.
