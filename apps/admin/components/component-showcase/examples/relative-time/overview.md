## When to use

- Times shown as "5 minutes ago" or "in 2 days" in activity feeds, comments and "last updated" stamps
- Timestamps that should stay correct while the page is open, ticking forward on their own

## When not to use

- A date people need exactly, such as an invoice date: show the formatted date
- A schedule or a calendar: use [Calendar](/components/calendar) or [Event Calendar](/components/event-calendar)

## Notes

- `epochMs` is the moment in epoch milliseconds; `region` sets the locale and time zone of the exact time in its `title`
- It renders a `time` element with the exact date-time, so the precise moment is never lost

## Relative Time: "5 minutes ago"

`RelativeTime` shows how long ago (or how soon) a moment is, in words, and keeps it fresh as time passes. The exact time is in the `time` element's `dateTime` and in its `title`, shown on hover.

### What is Relative Time?

A small text component for timestamps that matter relative to now: "just now", "3 hours ago", "in 2 days". It formats with `Intl.RelativeTimeFormat` in the display region's locale.

### Why use Relative Time?

For recent activity, "10 minutes ago" is quicker to read than "14 Nov 2026, 09:20". The exact time stays one hover away, and machine-readable.

### Relative Time features

- **Self-updating.** It re-renders as the minutes pass, from one shared clock.
- **Localised.** The region's locale and time zone.
- **Exact time.** A `time` element with a `title`.

## Integrating with other components

Use it in [Timeline](/components/timeline) items, [Item](/components/item) rows of an activity feed, [Message](/components/message) footers and table cells, with a [Hover Card](/components/hover-card) for richer detail.

## Frequently asked questions

### Does it update by itself?

Yes: all relative times on a page share one clock and re-render as it ticks.

### Is it accessible?

It renders a `time` element with `dateTime`, so the exact moment is machine-readable; the `title` shows it on hover. Add a [Hover Card](/components/hover-card) when keyboard users need the exact time too.
