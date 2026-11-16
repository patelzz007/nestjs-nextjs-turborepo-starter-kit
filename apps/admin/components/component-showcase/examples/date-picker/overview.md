## When to use

- A single date in a form, such as a due date, a start date or a date of birth
- Fields that store the date as a plain `yyyy-MM-dd` string, ready for a schema and an API
- Dates limited to a window, such as "from today" or "within this quarter"

## When not to use

- Several separate dates in one field: use [Multi Date Picker](/components/multi-date-picker)
- A from–to range, or a calendar always on screen: use [Calendar](/components/calendar)
- A filter on a month, a quarter or a year: use [Date Selector](/components/date-selector)

## Notes

- The value is a `yyyy-MM-dd` string, not a `Date`, so it round-trips through forms, URLs and JSON without time-zone surprises
- `fromDate` and `toDate` (also `yyyy-MM-dd`) disable the days outside the window

## Date Picker: one day, as a form field

`DatePicker` is a trigger button that opens a [Calendar](/components/calendar) in a popover and shows the chosen day formatted for the reader. It is the kit's ready-made single-date field: label it, give it a value and a change handler, and it behaves like any other field.

### What is Date Picker?

A field-shaped button, a popover and a calendar, wired together. Picking a day closes the popover and reports the date as `yyyy-MM-dd`.

### Why use Date Picker?

Every form with a date needs the same trigger, popover, calendar, formatting and bounds. `DatePicker` packages them with the field's states — `disabled`, `loading`, focus and blur for form libraries.

### Date Picker features

- **String value.** `yyyy-MM-dd` in and out.
- **Bounds.** `fromDate` and `toDate`.
- **Form-friendly.** `id`, `name`, `onBlur`, `onFocus`, `disabled` and `loading`.

## Integrating with other components

Label it with a [Label](/components/label) inside a [Field](/components/field), validate the string in your Zod schema, and pair it with [Time Picker](/components/time-picker) when a time of day is needed too.

## Frequently asked questions

### Why a string and not a `Date`?

A `Date` carries a time and a zone; a calendar day does not. `yyyy-MM-dd` says exactly which day was picked, wherever the code runs.

### How do I stop past dates?

Set `fromDate` to today in `yyyy-MM-dd`.

### Is it accessible?

The trigger is a button named by its label, and the calendar is the kit's keyboard-operable grid.
