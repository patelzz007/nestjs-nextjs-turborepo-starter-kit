## When to use

- A single date in a form, such as a due date, a start date or a date of birth
- Fields that store the date as a plain `YYYY-MM-DD` string, ready for a schema and an API
- Dates limited to a window, such as "from today" or "within this year"

## When not to use

- Several separate dates in one field: use [MultiDateField](/showcase/multi-date-picker)
- A from–to range, or a calendar always on screen: use [Calendar](/showcase/calendar)
- A filter on a month, a quarter or a year: use [DateSelector](/showcase/date-selector)

## Notes

- The value is a `YYYY-MM-DD` string, not a `Date`, so it round-trips through forms, storage and JSON without time zone surprises
- `minDate` and `maxDate` (also `YYYY-MM-DD`) rule out the days outside the window
- On a phone the calendar opens in a bottom sheet; the header's month and year open lists to jump far

## DateField: one day, as a form field

`DateField` is a field that opens a calendar in a bottom sheet and shows the chosen day written for the reader. Label it, give it a value and a change handler, and it behaves like any other field.

### What is it?

A field, a sheet and a calendar, wired together. Picking a day closes the sheet and reports it as `YYYY-MM-DD`.

### Why use it?

Every form with a date needs the same field, sheet, calendar, formatting and bounds. `DateField` packages them with the field's states: hint, error, disabled, loading, and focus and blur for form libraries.

### Features

- **String value.** `YYYY-MM-DD` in and out.
- **Bounds.** `minDate` and `maxDate`.
- **Form friendly.** `hint`, `error`, `onFocus`, `onBlur`, `disabled` and `loading`.
- **Any locale.** Day and month names from `locale`.

## Integrating with other components

Validate the string in your Zod schema, and pair it with [TimePicker](/showcase/time-picker) when a time of day is needed too.

## Frequently asked questions

### Why a string and not a `Date`?

A `Date` carries a time and a zone; a calendar day does not. `YYYY-MM-DD` says exactly which day was picked, wherever the code runs.

### How do I stop past dates?

Set `minDate` to today's `YYYY-MM-DD`.

### Is it accessible?

Yes. The field is a button named by its label and the picked day, and says it opens the calendar. Each day in the calendar is named by its full date.
