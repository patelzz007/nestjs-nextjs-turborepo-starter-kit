## When to use

- Picking a day, several days or a range where seeing the month matters: bookings, availability, schedules
- A screen whose main job is the calendar: an appointment flow, an event list
- Inside a sheet that a field opens, when the field needs more than a plain date (slots, presets, times)

## When not to use

- One date in a form: use [DateField](/showcase/date-picker), which opens a calendar in a sheet
- Several dates in a form: use [MultiDateField](/showcase/multi-date-picker)
- A date people type faster than they find (a known birth date): offer a typed field too
- A schedule of events across weeks: use [EventCalendar](/showcase/event-calendar)

## Notes

- Weeks start on Monday; dates are calendar days (`YYYY-MM-DD`), so no time zone moves them
- Two months stack, one above the other, rather than sitting side by side
- The header's month and year open lists to jump far without stepping month by month

## Calendar: an inline month calendar

`Calendar` picks one day, several days or a range from–to. It is controlled: `value` in, `onChange(next)` out, in the shape of its `mode`.

### What is it?

A month grid with a header that steps and jumps between months.

### Why use it?

It shows a day in its week and month, which a typed date does not: free days, weekends and ranges read at a glance.

### Features

- **Three modes.** `single` (a day), `multiple` (days, up to `maxDays`), `range` (from–to).
- **Ruled out days.** `minDate`, `maxDate` and `isUnavailable`; a range that would cross a ruled out day starts again.
- **Navigation.** Month steps, month and year lists, and `navigationLayout`; the shown month can be the caller's (`month`, `onMonthChange`).
- **Two months.** `numberOfMonths={2}`, stacked.
- **Extras per day.** `renderDayFooter` (a price, a dot) with `describeDay` for screen readers, taller cells, square or round marks, week numbers.
- **Any locale.** Day and month names from `locale`.

## Integrating with other components

Put it in a sheet a [DateField](/showcase/date-picker)-style `CalendarField` opens, beside a [ToggleGroup](/showcase/toggle-group) of time slots, over [Button](/showcase/button) presets, or above a [TimePicker](/showcase/time-picker).

## Frequently asked questions

### How do I start on a month other than the picked one?

Pass `month` and `onMonthChange`, and keep the shown month in state. A preset or a "back to today" button sets it.

### How do I block weekends?

Pass `isUnavailable`, a function from a day to whether it is ruled out. In range mode, a range crossing such a day starts again from the tapped day.

### Can it show prices or event dots?

Yes: `renderDayFooter` draws under each day, with `cellSize="lg"` for room. Say the same in `describeDay`, so screen readers hear it.
