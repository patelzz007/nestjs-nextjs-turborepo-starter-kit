## When to use

- Browsing a handful of related items one at a time: photos, onboarding steps, featured cards

## When not to use

- Content people must compare side by side: use a grid or a list
- A few photos of one thing: use ImageCarousel

## Notes

- Controlled: the caller holds the shown slide (`index`)
- Swipe, dots and arrows; `peek`, `perView`, `align="center"`, `orientation="vertical"`, `loop` and auto-play

## Carousel

`Carousel` shows slides one page (or several) at a time, with dots and optional arrows.

### Features

- **Peek** and **centred** layouts.
- **Several per view** (`perView`).
- **Vertical** columns.
- **Loop** both ways and **auto-play** that a touch stops.

## Integrating with other components

Fill slides with images, Cards or overlays; drive it from a thumbnail strip by sharing `index`.

## Frequently asked questions

### Does auto-play respect Reduce Motion?

Yes: it never runs with Reduce Motion on, and stops for good once the person swipes or taps a dot or arrow.
