## When to use

- Filtering a list or a report by a period: a day, a month, a quarter, a half year or a year
- Filters that read "before", "after" or "between", not just "on"
- Places where people type a period faster than they tap it ("Q1 2026", "2025")

## When not to use

- One date in a form: use [DateField](/showcase/date-picker)
- A calendar on screen for booking: use [Calendar](/showcase/calendar)
- A fixed set of presets ("Last 7 days"): use a [Select](/showcase/select) or [ToggleGroup](/showcase/toggle-group)

## Notes

- Days are calendar days (`YYYY-MM-DD`), never `Date`s, so no time zone moves them
- "Between" picks a range: the first tap is one end, the second the other, in either order
- Typed entry reads a year, a quarter (`Q2`, `Q1 2026`) or a day in the selector's day format

## DateSelector: a period filter

`DateSelector` is the panel; `DateSelectorField` is a field that opens it in a bottom sheet over a draft, with Cancel and Apply.

### What is it?

A filter value made of a period, an operator and the picked period (or the two ends of a range).

### Why use it?

Reports and lists filter by more than a day. One control covers "invoices in Q3", "orders before 2025" and "visits between March and June".

### Features

- **Five periods.** Day, month, quarter, half year, year; `periodTypes` narrows them.
- **Four filters.** Is, before, after, between; `presetMode` locks one, `allowRange={false}` drops Between.
- **Typed entry.** A year, a quarter or a day in `dayFormat`.
- **Any language.** `labels` for every word, `locale` for the calendar, `dayFormat` and `weekStartsOn`.

## Integrating with other components

Put the field over a [DataTable](/showcase/data-table) or a list as its date filter; show the value with `formatDateSelectorValue` in a [Badge](/showcase/badge) or a [Filters](/showcase/filters) chip.

## Frequently asked questions

### How do I turn the value into a query?

Read `period` and `operator`, then the field for that period: `startDate` / `endDate` for days, `year` plus `month`, `quarter` or `halfYear`, or `rangeStart` / `rangeEnd` for a range of periods.

### Can people type instead of tapping?

Yes: the typed entry reads `2025`, `Q4`, `Q1 2026` or a day such as `15/11/2026`, and says when it cannot.
