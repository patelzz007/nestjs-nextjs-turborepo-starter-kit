## When to use

- A schedule of events by date and time: meetings, bookings, appointments
- Several people's or rooms' days side by side (the resource view)

## When not to use

- Work across weeks with dependencies: use Gantt
- Picking one date: use a date field or Calendar

## Notes

- Lays events out with the web kit's rules (`@workspace/ui-kit-logic` `event-calendar`): view ranges, recurrence, packing overlaps into columns
- Month (tap a day to list it), week and day time grids, resources side by side, and an agenda
- A tap on free time reports the slot; a drag down free time books one, refused while `canSelectSlot` says no

## EventCalendar

`EventCalendar` shows events by month, week, day, resource or agenda, with a toolbar for the period and the view; events are buttons, days of the month say how many they hold, and free time can be tapped or dragged to book.

### Features

- **Views**: month, week, day, resources, agenda.
- **Recurrence** (RRULE strings or rules) expanded for the visible range.
- **Booking**: a tap or a drag on free time, with a guard against overlaps.
- **Custom chips** through `renderEvent`.
- **Time zones**, the week's first day, the grid's hours and shaded weekends.

## Integrating with other components

Open a Dialog from `onSlotPress` or `onEventPress` to create or edit an event; show a legend of the tones; check overlaps in `canSelectSlot`.

## Frequently asked questions

### How do people book a time on a phone?

On a day, week or resource grid, drag down a free stretch: the drawn slot snaps to `slotMinutes` and is reported to `onSelectSlot` (unless `canSelectSlot` refuses it). A tap reports one slot.

### Can events be dragged to move them?

Not on a phone yet: open the event (`onEventPress`) and change it in a form. The web kit drags and resizes.
