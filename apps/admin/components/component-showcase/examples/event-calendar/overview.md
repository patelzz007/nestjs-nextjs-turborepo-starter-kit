## When to use

- Team calendars in month, week, day and agenda views where events are added, edited and dragged
- Room and appointment bookings laid out as one column per resource, or as a single day of open slots
- Project and campaign plans drawn as colour-coded bars spanning several days of a month

## When not to use

- A date or a date range in a form, with no hours, events or dragging: use [Calendar](/components/calendar) or [Date Picker](/components/date-picker)
- Bars along a timeline of weeks and months, with dependencies: use [Gantt](/components/gantt)

## Notes

- Pass `defaultEvents` for an uncontrolled calendar, or `events` with `onEventsChange` to keep drags, resizes and edits in your store
- Generate new event ids from your store once events persist
- Give the root a height (`h-[600px]`), as with the gantt

## Event Calendar: events by day and hour

`EventCalendar` is a full calendar: a subscribable engine (`useEventCalendarState`) owns the events, the view, the date, the selection and the interactions, and a composable UI renders month, week, day, N-day, agenda and resource time-grid views, with drag to move and resize, drag to create, and recurrence.

### What is Event Calendar?

A provider with slots: `<EventCalendar>` around `<EventCalendarNav />`, an optional toolbar, and `<EventCalendarContent />`. Every state — events, view, date, day count, selection, interactions — can be controlled or left to the calendar.

### Why use Event Calendar?

Scheduling — meetings, rooms, shifts, campaigns — needs a real calendar: several views, time grids, drag and drop, all-day bars and repeating events. Building one per app is a project of its own.

### Event Calendar features

- **Views.** Month, week, day, N days, agenda and resource columns.
- **Interactions.** Drag to move, resize and create; select a slot.
- **Recurrence.** An RFC 5545 subset, or plug your own engine.
- **Custom chips.** `renderEvent` for any event content.
- **Time zones and locales.** Laid out in the chosen zone, with localised labels.

## Integrating with other components

Edit events in a [Dialog](/components/dialog) opened from a slot or an event (the Event Form Dialog example), show attendees with [Avatar](/components/avatar)s inside chips, and keep events in TanStack Query with `onEventsChange` mutations.

## Frequently asked questions

### How do I save drags and edits?

Control the events: `events` and `onEventsChange`, then persist in a mutation.

### Can it book rooms?

Yes: the resource view lays out one column per room, as the Room Bookings example does.

### Does it support repeating events?

Yes: a recurrence rule on an event expands into occurrences; plug a full RRULE engine where you need more.

### Is it accessible?

Events and slots are focusable and keyboard-operable; navigation is labelled, and dates and times are announced in words.
