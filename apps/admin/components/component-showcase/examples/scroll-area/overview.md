## When to use

- Fixed-height lists and image columns that scroll inside their own box with a slim scrollbar
- Sideways strips of cards or photos kept to the width of their container
- Wide tables that pan on both axes without widening the page around them

## When not to use

- Section links that light up as the reader scrolls past each heading: use [Scrollspy](/components/scrollspy)
- A chat transcript that opens on the newest message and follows streamed replies: use [Message Scroller](/components/message-scroller)

## Notes

- Give the root a bounded height or width through `className`, or it grows with its content and never scrolls
- Only the vertical `ScrollBar` is drawn by default: add `<ScrollBar orientation="horizontal" />` for sideways scrolling

## Scroll Area: a scrolling box with a slim scrollbar

`ScrollArea` makes a region scroll inside itself with a thin, themed scrollbar, built on Base UI's scroll area. Native scrolling — touch, wheel, keyboard — is kept; only the scrollbar is drawn by the kit.

### What is Scroll Area?

A viewport and one or two scrollbars. The scrollbars appear on hover and while scrolling, and fade edges can hint that more content lies beyond.

### Why use Scroll Area?

Lists in cards, sidebars and popovers need to scroll without the page's heavy scrollbar breaking the design, and without losing native scrolling.

### Scroll Area features

- **Vertical, horizontal or both.**
- **Native scrolling.** Touch, wheel, keyboard and scroll-snap all work.
- **Fade edges.** A hint that the content continues.

## Integrating with other components

Wrap long lists in a [Card](/components/card) or a [Popover](/components/popover), a [Table](/components/table) that pans sideways, or a [Code Block](/components/code-block)'s `CodeBlockContent` to own its scrolling.

## Frequently asked questions

### Why does my scroll area not scroll?

Its root has no bounded size: give it `h-72` (or `max-h-*`, on the viewport) or a width for horizontal scrolling.

### Is it accessible?

Scrolling is native, so the keyboard and assistive technology work as usual. Make the viewport focusable (`tabIndex={0}`) when it holds no focusable content.
