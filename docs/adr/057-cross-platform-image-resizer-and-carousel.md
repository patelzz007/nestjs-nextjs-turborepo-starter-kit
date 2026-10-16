---
title: "ADR 057: One Image-Resize Geometry, and Carousel Parity, on Every Platform"
tags: ["adr", "image", "carousel", "ui", "mobile", "docs"]
description: "The drag-to-resize image's geometry lives once in @workspace/shared and each kit renders it with its own input system. Carousels stay on Embla on the web and in the docs, and on a paging ScrollView in the native kit, with the same controls everywhere. The docs reuse the web components as hydrated islands."
author: "Platform Team"
lastUpdated: 1792195200000
coverImage: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1600&q=80"
order: 57
---

# ADR 057: One Image-Resize Geometry, and Carousel Parity, on Every Platform

## Status

Accepted (2026-10-17).

## Context

Two dumb components were requested for every platform (the web, admin and merchant apps, the
mobile app and the docs site): an **Embla carousel** and an **image resizer**, meaning an image the
user resizes by dragging handles.

The carousel already partly existed. `@workspace/ui` had an Embla `Carousel` and an
`ImageCarousel`. `@workspace/ui-native` had a `Carousel` built on a paging `ScrollView`, without
arrows or a counter, which also showed dots for a single image. The docs site had no carousel.
Embla works on the DOM, so it cannot run in React Native.

Nothing could resize an image. `ImageCropper` chooses a region of a photo, which is a different
job.

## Decision

1. **The resize geometry lives once, in `@workspace/shared`** (`packages/shared/src/lib/image-resize`).
   It covers the handles, the constraints and their defaults, the clamping, aspect-ratio locking,
   resizing from where a drag started, and screen-reader nudges. It is pure TypeScript, like the
   QR encoder (ADR 054), so every platform clamps and keeps the ratio identically.
2. **Each kit renders with its own input system and no new dependency.**
   - **Web:** `ImageResizer` uses pointer events with pointer capture. Its handles are buttons that
     take the arrow keys, Shift for large steps and Escape to cancel. The size is announced through
     a live region.
   - **Native:** `ImageResizer` uses React Native's gesture responder (as `Slider` does). Each
     handle is an adjustable control with screen-reader increment and decrement.
   - Both are controlled: `value` goes in, and changes come out during the drag and once at the end.
     The web kit calls these `onValueChange` / `onValueCommitted`, the native kit
     `onChange` / `onChangeEnd`, following each kit's naming.
3. **The carousel keeps one engine per runtime.** The web and the docs use Embla. The native kit
   uses a paging `ScrollView`. The native kit gains what the web one had: `showControls`
   (previous / next, disabled at either end), the "n / total" counter on each picture
   (`showCounter`), and a plain cover for a single image.
4. **The docs site reuses the web components; it does not re-implement them.** Two fences,
   ```` ```carousel ```` and ```` ```image-resize ````, are rendered by the web kit's
   `ImageCarousel` / `ImageResizer` at build time. The browser then hydrates them as islands, the
   same way code blocks already work. React and Embla load only on pages that have such an island,
   and the props in the page are checked with zod before hydration.

## Consequences

- One change to the geometry changes all three platforms, and its tests live in one place.
- Gestures on mobile have no physics or inertia; resizing does not need them. A product that needs
  pinch-to-resize should add `react-native-gesture-handler` and feed the same shared functions.
- On mobile, the carousel swipes with the platform's own paging feel rather than Embla's. The
  controls and contract match, but the motion does not.
- The docs bundle includes Embla and the kit's image components, but only on pages that use them.

## Alternatives considered

- **Embla for the native carousel through a WebView.** Rejected: it adds a web runtime to a list of
  pictures, and the gestures would conflict with the screen's own scrolling.
- **`react-native-gesture-handler` / Reanimated gestures for the native resizer.** Rejected for
  now: the responder system already covers one-finger drags with no new native dependency.
- **CSS `resize: both` on the web.** Rejected: it gives one corner, no keyboard support, no aspect
  ratio and no bounds, and it does not exist on mobile.
- **A separate vanilla-JS carousel and resizer for the docs.** Rejected: that would be a third
  implementation to keep in step. The island approach renders exactly the apps' components.
