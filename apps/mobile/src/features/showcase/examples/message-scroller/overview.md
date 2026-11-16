## When to use

- Chat transcripts and assistant threads that grow at the end

## When not to use

- Static lists: use a FlatList

## Notes

- The web's parts and hooks: a provider, the viewport, the content, one item per message, jump buttons
- Follows the end while the reader is there; keeps their place when history loads above

## MessageScroller

`MessageScroller` keeps a transcript's newest message in view as messages arrive, lifts a sent question to the top, and never pulls a reader away from what they are reading.

### Features

- **Opening position**: the end, the start, or the last anchored turn.
- **Follows** growth at the end.
- **Anchored turns** lifted under a peek.
- **Keeps its place** when older messages load.
- **Hooks** to scroll, and to read what is in view.

## Integrating with other components

Fill items with Messages and Bubbles; put a composer under it; drive a navigator with `useMessageScrollerVisibility`.

## Frequently asked questions

### What happens when older messages load?

The reader stays on the message they were reading: the scroller moves by exactly as much as the new messages pushed it.
