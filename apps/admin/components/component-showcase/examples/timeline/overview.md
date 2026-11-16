## When to use

- Project milestones, product roadmaps and release histories, stacked or laid out in a row
- Activity feeds and logs, such as git events, deploy runs and team actions
- Progress through ordered stages, such as an order's shipping or a build pipeline

## When not to use

- A multi-step form or setup flow people click through: use [Stepper](/components/stepper)
- A date-and-time grid of events: use [Event Calendar](/components/event-calendar)

## Notes

- Progress moves when you pass a new `value`: items up to it are marked completed
- `defaultValue` is 1 when omitted, so the first item shows as completed; pass 0 when nothing is done yet
- Keep each `TimelineItem` a direct child of `Timeline`, or its separator hides as if it were the last item

## Timeline: events in order

`Timeline` lays out events along a line — vertically by default, or in a row — each with a date, a title, an indicator and content. Items up to the current `value` are marked completed, so the same component shows a history and a progress track.

### What is Timeline?

`TimelineItem`s, each with a `TimelineHeader` (`TimelineDate`, `TimelineTitle`), a `TimelineIndicator` on the line, a `TimelineSeparator` to the next item, and `TimelineContent`.

### Why use Timeline?

Chronology is easier to read on a line than in a table: what happened, when, and in what order — and, for a pipeline, how far it has got.

### Timeline features

- **Vertical or horizontal.** `orientation`.
- **Completed state.** `value` marks items up to a step.
- **Custom indicators.** Icons, avatars or status dots.
- **Layouts.** Dates beside or above, alternating sides, compact rows.

## Integrating with other components

Show people with [Avatar](/components/avatar)s on the indicators, statuses with [Badge](/components/badge)s, and exact times with [Relative Time](/components/relative-time).

## Frequently asked questions

### How do I show progress?

Pass `value` with the last completed step; items up to it get `data-completed` and the completed styling.

### Can it run horizontally?

Yes: `orientation="horizontal"`, as the Horizontal example does.

### Is it accessible?

It is an ordered list of items; dates and titles are text, so the order and the content are read in sequence.
