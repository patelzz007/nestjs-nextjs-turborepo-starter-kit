## When to use

- Inline grids for picking one day, several separate days or a from–to range
- Date and date-range fields that open the grid in a popover under a trigger button
- Booking and planning steps that pair a day with time slots, daily prices or an event list

## When not to use

- A filter over day, month, quarter or year periods with before, after and between: use [Date Selector](/components/date-selector)
- A month, week or day view of entries that people drag, resize and create: use [Event Calendar](/components/event-calendar)
- A single date field: [Date Picker](/components/date-picker) wraps the calendar in a field and a popover for you

## Notes

- `selected` takes a `Date`, a `Date` array or a `DateRange`, to match `mode` `single`, `multiple` or `range`
- Without `required`, clicking the only selected day clears it, so `onSelect` can hand back `undefined` or an empty array

## Calendar: a month grid for days and ranges

`Calendar` is the kit's month grid, built on React DayPicker. It picks a single day, several days or a range, shows one or more months, and takes DayPicker's full API — disabled days, modifiers, week numbers, locales — styled with the kit's tokens and buttons.

### What is Calendar?

The grid behind every date control in the kit. On its own it is an inline picker; inside a [Popover](/components/popover) it becomes a date field; beside a list it drives a booking step.

### Why use Calendar?

Seeing the month helps people pick relative dates ("next Friday") and ranges. One calendar component means every date control in the app looks, navigates and announces the same way.

### Calendar features

- **Three modes.** `single`, `multiple` and `range`.
- **Disabled days.** Past dates, weekends or any matcher.
- **Navigation.** Dropdowns for month and year (`captionLayout`), several months side by side.
- **Week numbers and locales.** From DayPicker.
- **Custom days.** Prices, dots or events per day through custom components.

## Integrating with other components

Open it from a [Button](/components/button) in a [Popover](/components/popover) for a date field (or use [Date Picker](/components/date-picker)), pair it with [Time Picker](/components/time-picker) for a date and time, and list presets ("Last 7 days") beside a range calendar.

## Frequently asked questions

### Calendar or a typed input?

A calendar when people think in weeks and months, or pick ranges; a typed input for dates people know, such as a birthday. [Date Picker](/components/date-picker) offers both.

### How do I show it in a popover?

Put it in `PopoverContent`, open it from a trigger button, and close the popover in `onSelect`. The Date Picker examples do exactly that.

### Can I disable weekends or past dates?

Yes: `disabled={[{ dayOfWeek: [0, 6] }, { before: today }]}`.

### How do I pick a range?

`mode="range"` with a `DateRange` (`{ from, to }`) in `selected`; `numberOfMonths={2}` shows two months side by side.
