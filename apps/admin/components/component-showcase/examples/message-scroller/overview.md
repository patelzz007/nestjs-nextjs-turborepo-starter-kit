## When to use

- Chat and assistant transcripts in a bounded panel that open on the newest turn and offer a jump back to it
- Streaming replies that follow the bottom until the reader scrolls up, with a sent question lifted near the top
- Saved threads that reopen at a chosen turn, load older history above, or step between questions

## When not to use

- The layout of a single turn: use [Message](/components/message)
- A panel that overflows but never grows at the bottom: use [Scroll Area](/components/scroll-area)

## Notes

- The parts and hooks throw outside `MessageScrollerProvider`: a header or footer control that calls a hook needs the provider above it too
- `MessageScroller` fills its parent (`size-full`), so bound the parent's height or the page scrolls instead
- Render `MessageScrollerButton` as a sibling of `MessageScrollerViewport`, or it scrolls away with the rows

## Message Scroller: a transcript that follows

`MessageScroller` is the scrolling container of a chat: it opens on the newest turn, sticks to the bottom while a reply streams, stops following when the reader scrolls up, and shows a "jump to latest" button. It keeps the reader's place when older messages load above.

### What is Message Scroller?

A provider, a viewport, a content list of `MessageScrollerItem`s and a `MessageScrollerButton`, with hooks to scroll to a turn, know which turns are visible, and load more.

### Why use Message Scroller?

Chat scrolling is subtle: follow new content, but never yank the reader; keep the position when history loads; lift a just-sent question into view. Getting it right once spares every chat screen.

### Message Scroller features

- **Stick to bottom.** While streaming, until the reader scrolls up.
- **Jump to latest.** A button that appears when away from the bottom.
- **Anchored turns.** Lift a sent question near the top while its answer streams.
- **Load earlier.** History added above without a jump.
- **Opening position and navigation.** Open at a turn; step between questions.

## Integrating with other components

Put [Message](/components/message)s in its items, a composer [Input Group](/components/input-group) below it, and the whole in a [Card](/components/card) or a [Sheet](/components/sheet).

## Frequently asked questions

### Why does the page scroll instead of the transcript?

The scroller fills its parent: give the parent a height (or make it a flex child with `min-h-0`).

### How do I load older messages?

Prepend them: the scroller keeps the reader's position, as the Load Earlier example does.

### Is it accessible?

The viewport is a focusable, labelled region; the jump button is named, and new turns can be announced through a live region in your messages.
