## When to use

- Several separate days in one field: blackout days, holidays, delivery dates
- A limited number of days (`maxDates`)

## When not to use

- One day: use [DateField](/showcase/date-picker)
- A continuous span: use a range [Calendar](/showcase/calendar)
- Recurring days ("every Monday"): use [ToggleGroup](/showcase/toggle-group) of weekdays

## Notes

- The value is a list of `YYYY-MM-DD` strings, kept in date order without repeats
- Once `maxDates` are picked, the other days are ruled out until one is unpicked
- On a phone the calendar opens in a bottom sheet

## MultiDateField: several days, as a form field

`MultiDateField` is a field that opens a calendar in a bottom sheet where each tap picks or unpicks a day.

### What is it?

A field showing the picked days, a sheet and a calendar in multiple mode.

### Why use it?

Separate days are tedious as several date fields; one calendar shows them all together.

### Features

- **List value.** `YYYY-MM-DD` strings in date order.
- **A limit.** `maxDates`.
- **Bounds.** `minDate` and `maxDate`.

## Integrating with other components

Validate the list in your Zod schema, and say the limit in the field's `hint`.

## Frequently asked questions

### How do I unpick a day?

Tap it again in the calendar.

### What happens at the limit?

The days not yet picked are disabled until one is unpicked, so the limit is never passed.
