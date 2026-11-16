## When to use

- Activity feeds, comments and last-updated stamps
- Times close to now, where “5 minutes ago” reads faster than a clock time

## When not to use

- Dates the reader must act on (due, expiry, signing): show the date
- Durations: format them as a length of time

## Notes

- Controlled: the screen passes `now` and ticks it; the text only moves when it does
- The wording comes from `labels` (Hermes, React Native's engine, has no relative-time formatter); the absolute date uses Intl.DateTimeFormat

## RelativeTime

`RelativeTime` shows an instant relative to now (“3 minutes ago”, “in 2 days”); screen readers also hear the exact date and time.

### Features

- **Labels** in any language (`labels`), English by default; a short set for tight spaces.
- **Locale and time zone** for the spoken absolute date.

## Integrating with other components

Use it in a list row's detail, a message's timestamp or a card footer.

## Frequently asked questions

### Why does it not update by itself?

The screen owns the clock: one tick for the whole screen, not one timer per label.
