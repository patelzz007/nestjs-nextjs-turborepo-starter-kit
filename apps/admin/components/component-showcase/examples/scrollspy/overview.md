## When to use

- A table of contents that marks which section of a long page, or a scrolling panel, is in view
- Jump links that scroll their content to the chosen section and keep that link highlighted

## When not to use

- A bounded panel that only needs its own scrollbar: use [Scroll Area](/components/scroll-area)
- A chat transcript that follows new messages: use [Message Scroller](/components/message-scroller)

## Notes

- `targetRef` points at the scrolling element; without one, the spy follows the document
- `targetRef` may sit on a wrapper around a `ScrollArea`: the spy finds its viewport and tracks and scrolls that
- `history` (on by default) keeps the URL hash in step with the section; pass `history={false}` to leave the URL alone

## Scrollspy: links that follow the reader

`Scrollspy` watches a scrolling container and marks the link of the section currently in view, and scrolls to a section when its link is clicked. Links are plain anchors marked with `data-scrollspy-anchor`, so they keep working without JavaScript.

### What is Scrollspy?

A wrapper around a list of links — a table of contents, a horizontal section nav — that sets `data-active` on the link of the visible section.

### Why use Scrollspy?

On long pages, an outline that follows the reader shows where they are and how much is left, and lets them jump anywhere.

### Scrollspy features

- **Any container.** The document, a `div`, or a kit `ScrollArea`.
- **Offset.** For a sticky header above the sections.
- **Smooth scrolling.** `smooth` on link clicks.
- **URL hash.** `history` keeps the hash in sync.

## Integrating with other components

Pair it with a [Scroll Area](/components/scroll-area) panel of sections, or a long settings page with a side outline. Style the active link from `data-active`.

## Frequently asked questions

### How do I mark a link?

Give it `data-scrollspy-anchor="section-id"` matching the section's `id`.

### How do I account for a sticky header?

Pass `offset` with the header's height in pixels.

### Is it accessible?

The links are ordinary anchors; set `aria-current="true"` on the active one from `onUpdate` if you also want it announced.
