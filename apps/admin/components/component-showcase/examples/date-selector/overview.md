## When to use

- Report and list filters on a day, a month, a quarter, a half-year or a year, with is, before, after or between
- Due-date fields opened from a button into a popover or a dialog and committed on Apply
- Localised pickers with translated months, a regional date format and a Monday-first week

## When not to use

- One day, or a from–to span, with no period tabs or operators: use [Calendar](/components/calendar)
- A date condition beside other field conditions in one query bar: use [Filters](/components/filters)

## Notes

- Year lists default to the eleven years up to the current one: pass `maxYear` (and `minYear`) to offer other years
- Pass a stable state setter to `onChange`, never an inline API call

## Date Selector: dates as filters

`DateSelector` picks a period — a day, a month, a quarter, a half-year or a year — with an operator: is, before, after or between. It is built for filters and reports, where "Q3 2026" or "before March" is the question, not a single day.

### What is Date Selector?

A panel with period tabs, an operator choice, the period's grid (a calendar for days, lists for months, quarters and years) and a text summary of the value. It works inline, in a popover or in a dialog, committed on Apply.

### Why use Date Selector?

Reports filter by month, quarter and year far more than by day. A day calendar forces people to translate "Q3" into dates; `DateSelector` lets them pick the period directly, and the value says exactly what was meant.

### Date Selector features

- **Five periods.** Day, month, quarter, half-year and year.
- **Four operators.** Is, before, after and between (ranges of any period).
- **Inline, popover or dialog.** With an Apply step when wrapped.
- **Localised.** Months, formats and the first day of the week (`weekStartsOn`).
- **Helpers.** `useDateSelector` for a custom surface; `formatDateValue` for the summary text.

## Integrating with other components

Open it from a [Button](/components/button) in a [Popover](/components/popover) or a [Dialog](/components/dialog), and show the chosen value in the trigger with `formatDateValue`. Beside other conditions, [Filters](/components/filters) is the better container.

## Frequently asked questions

### How do I store the value?

`DateSelectorValue` is plain data — the period, the operator and the dates — so it can go into a URL or an API filter as it is.

### Can it pick a range of quarters?

Yes: choose the quarter tab and the between operator.

### Is it accessible?

The tabs, the operator and the grids are keyboard-operable kit controls, and the summary is plain text.
