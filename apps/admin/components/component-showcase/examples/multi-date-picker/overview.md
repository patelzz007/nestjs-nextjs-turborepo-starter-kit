## When to use

- Several separate days in one field, such as blackout days, holidays or delivery dates
- Schedules where the chosen days are not a continuous range

## When not to use

- One day: use [Date Picker](/components/date-picker)
- A continuous from–to range: use [Calendar](/components/calendar) in `range` mode

## Notes

- Each click picks or un-picks a day; the trigger lists the chosen days, formatted by `formatDate`
- The value is an array of `yyyy-MM-dd` strings, sorted

## Multi Date Picker: several days in one field

`MultiDatePicker` opens a calendar in which every click toggles a day, and lists the chosen days in the trigger. It is the field form of the calendar's `multiple` mode, with the same string values as `DatePicker`.

### What is Multi Date Picker?

A field for "these particular days": Sep 4, Sep 14 and Oct 3. A limit caps how many days can be chosen.

### Why use Multi Date Picker?

Non-contiguous dates are awkward as several date fields and impossible as a range. One field that lists them is clear to read and easy to edit.

### Multi Date Picker features

- **Toggle days.** Each click adds or removes a day.
- **A readable trigger.** The chosen days, formatted by `formatDate` (date-fns `PP` by default).
- **Limits and bounds.** `maxDates`; `fromDate` and `toDate`.
- **Form-friendly.** `id`, `onBlur`, `onFocus`, `disabled` and `loading`.

## Integrating with other components

Use it in a [Field](/components/field) with a label and an error, and validate the array in your schema (at least one day, at most the limit).

## Frequently asked questions

### How do I limit the number of days?

Set `maxDates`; once it is reached, only the picked days can be clicked, to unpick them.

### What does the value look like?

An array of `yyyy-MM-dd` strings, such as `["2026-09-04", "2026-09-14"]`.
