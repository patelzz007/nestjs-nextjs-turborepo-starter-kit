## When to use

- Dashboard, settings and status sections with a title bar, panels and a footer line
- Lists of services, records or log entries joined into one stacked column of bordered panels
- A titled shell around other parts, such as a collapsible run step that opens to its instructions

## When not to use

- Several sections that each expand and collapse: use [Accordion](/components/accordion)
- A standalone titled surface with actions: use [Card](/components/card) — and never nest a Card in a Frame

## Notes

- `dense` strips the frame's own padding and gap and pulls each `FramePanel` onto the outer border; the panels keep their padding
- `stacked` joins only `FramePanel`s that are adjacent direct children of `Frame`; a wrapper around one leaves both rounded
- `FramePanel` grows into spare height; pass `fit` when a panel should keep its content's height
- The radius follows `--frame-radius`: `className="[--frame-radius:var(--radius-lg)]"`

## Frame: a container of panels

`Frame` is a muted container that holds one or more `FramePanel`s, with an optional header (`FrameHeader`, `FrameTitle`, `FrameDescription`) and footer. Panels can sit apart, stack into one bordered column, or run flush in a dense layout.

### What is Frame?

The grouped-panel pattern of settings pages and status boards: a section title, then panels of content inside a soft frame. It replaces nesting cards inside cards.

### Why use Frame?

Pages with many related groups need structure without heavy borders everywhere. A frame groups panels visually, keeps one radius system, and its spacing scales with one prop.

### Frame features

- **Panels.** Separated, `stacked` into one column, or `dense`.
- **Header and footer.** Title, description and a footer line.
- **Spacing and radius.** `spacing` (`xs` to `lg`) and `--frame-radius`.
- **Variants.** Default and `ghost`.

## Integrating with other components

Put [Alert](/components/alert)s, [Item](/components/item) rows, [Switch](/components/switch) settings and [Collapsible](/components/collapsible)s inside panels. The showcase's own example previews sit in a `Frame`.

## Frequently asked questions

### Frame or Card?

A [Card](/components/card) is one surface with a title and actions; a frame groups several panels under one heading. Pick one per surface.

### How do I change the radius?

Set `--frame-radius` on the frame; panels derive their radius from it.

### Is it accessible?

It is a layout container; give the section a heading (`FrameTitle`) so it shows in the page outline.
