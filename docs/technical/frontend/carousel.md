---
title: "Carousels"
tags: ["carousel", "image", "ui", "mobile", "docs", "embla"]
description: "Carousel and ImageCarousel on every platform: Embla on the web and in the docs, a paging ScrollView in the native kit, the same controls everywhere, and carousel fences in the docs."
order: 29
author: "Platform Team"
lastUpdated: 1793491200000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
---

# Carousels

Two carousel components exist in both UI kits:

- **`Carousel`** is a strip of slides of any content.
- **`ImageCarousel`** is a gallery of pictures in one aspect ratio, built from `Carousel` and
  `CoverImage`.

Every platform gets the same controls: swiping, previous and next arrows, a dot per slide, a
"2 / 5" counter, and a plain cover when there is only one image. Each platform draws them with its
own engine ([ADR 057](../../adr/057-cross-platform-image-resizer-and-carousel.md)).

```carousel ratio="1360/1300"
![The welcome email](images/email/welcome.png)
![The verification email](images/email/verification.png)
![The password reset email](images/email/password-reset.png)
```

The gallery above is a `carousel` fence in this page's markdown, drawn by the web kit's
`ImageCarousel` (see [In the docs](#in-the-docs)).

## Web — `@workspace/ui` (Embla)

The web `Carousel` wraps [Embla](https://www.embla-carousel.com/) (`embla-carousel-react`). It is a
compound component: `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious` and
`CarouselNext`. Embla options and plugins pass through `opts` and `plugins`, and `setApi` hands the
Embla API to the caller. The arrow keys move between slides, and slides are labelled from the
`carousel` label family.

`ImageCarousel` adds overlaid arrows, a counter and dots to it, and **loops** (Embla `loop: true`,
`imageCarouselOptions`): after the last image the next arrow (or a drag) brings the first in from the
right, still sliding left, and the previous arrow (or a drag back) on the first brings the last in from
the left — never a rewind back across every image. A carousel that auto-advances must
loop the same way and only ever call `scrollNext()` (the admin's Autoplay example), never
`scrollTo(0)`. Only the first image shown loads
eagerly, and only with `priority`. Each image loads the rendition its width needs (`sources` +
`sizes`). `startIndex` picks the first image shown, and `onSelectedIndexChange` reports the image
being shown. See `packages/ui/README.md` and the admin's `/components/carousel` and
`/components/image-carousel` pages.

## Mobile — `@workspace/ui-native`

Embla needs the DOM, so it cannot run in React Native. The native `Carousel` is a horizontal
**paging `ScrollView`** with the same contract, and it is **controlled**: the screen owns `index` and
hears every change through `onChange`, whether it came from a swipe, a dot or an arrow.

| Control | Web | Native |
| --- | --- | --- |
| Swipe / drag | Embla | Paging `ScrollView` (`onMomentumScrollEnd`) |
| Dots | `ImageCarousel` dots (`goToSlide`) | `Carousel` dots (`slideLabel`), `showIndicators` |
| Previous / next | `CarouselPrevious` / `CarouselNext`; with `loop` neither is ever disabled | `showControls` (`previousLabel`, `nextLabel`); previous is disabled on the first slide and next on the last, unless the carousel loops |
| Keyboard | Arrow keys | Not applicable. Screen readers use the dots and arrows |
| Counter | `ImageCarousel` "2 / 5" | `ImageCarousel` "2 / 5" on each picture (`showCounter`), hidden from screen readers |
| One image | A plain `CoverImage` | A plain `CoverImage` |

`clampCarouselIndex(index, total)` keeps an index within the slides. Only the slide being shown is
exposed to screen readers. See them under **Settings → Components → Media**.

Three optional props turn the native `Carousel` into a content carousel (a row of cards). Without them
it pages full-width slides that touch, exactly as before, and `ImageCarousel` is unchanged.

| Prop | Default | What it does |
| --- | --- | --- |
| `peek` | `0` | Points of the next slide shown at the edge. Each slide is `width − peek − gap` wide. |
| `gap` | `12` when peeking, otherwise none | Points between slides. Without a peek, full-width slides sit `gap` apart while swiped and still fill the width when they settle (Home's Discover cards use 16). |
| `autoPlayIntervalMs` | off | Moves on every N ms; after the last slide the first slides in from the right (it always loops). It needs two slides or more. |
| `loop` | off (on with auto-play; always on in `ImageCarousel`) | Goes round, both ways: after the last slide the first comes in from the right, and before the first the last comes in from the left — each sliding like every other step. Both arrows stay on, and a swipe past either end goes round. |

- **Snapping.** Slides that peek or sit apart snap slide by slide (`snapToInterval = slideWidth + gap`,
  `decelerationRate="fast"`, `disableIntervalMomentum`, so one fling moves one slide) instead of
  `pagingEnabled`. The settled slide is `round(offsetX / interval)`. The arithmetic is exported and
  tested: `carouselSlideMetrics`, `carouselGapOf`, `nextCarouselIndex`.
- **Looping, both ways.** A copy of the last slide sits before the first and a copy of the first after
  the last (both hidden from screen readers), so every real slide sits one place along. Going round
  slides onto a copy, then swaps to the real slide with no animation — they look the same — as the
  pager reports reaching it (`onScroll` every frame), when a swipe settles on it, or at the latest before
  the next move. So last → first slides left and first → last slides right, like every other step,
  instead of scrolling back across them all. `carouselScrollTarget` and `carouselLoopJump` hold the
  arithmetic and are tested. The first placement after layout, and every move with Reduce Motion, is
  direct.
- **Auto-play stops for good** once the person takes over: a drag, a dot or an arrow. It never runs with
  Reduce Motion on (WCAG 2.2.2: moving content must be stoppable). It runs one timer per slide shown, so
  a manual change restarts the interval. The kit cannot know whether its screen is in front, so the
  caller passes `undefined` while it is not (`useIsFocused()`). See
  `apps/mobile/src/features/home-highlights`.

## In the docs

A ```` ```carousel ```` fence lists two to twelve images, one `![alt](url)` per line. Repo-relative
`images/…` paths work the same as they do in prose:

````md
```carousel ratio="16/9"
![The welcome email](images/email/welcome.png)
![The verification email](images/email/verification.png)
```
````

`ratio` is width/height (or a single number) for every slide, and defaults to 16/9. URLs must be
site paths or `https://`. The build renders the web `ImageCarousel` to HTML, so the images show
before any JavaScript runs. Pages that have one then load React and Embla, and hydrate the gallery
into the live component (`apps/docs/src/lib/media/`, `src/scripts/media-islands.ts`). Pages
without one never download them.
