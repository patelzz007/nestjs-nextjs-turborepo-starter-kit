## When to use

- A time of day: an alarm, an appointment, opening hours
- Times limited to steps, bounds or free slots
- A time shown in the person's 12- or 24-hour clock

## When not to use

- A duration (2 h 30 min): use [NumberField](/showcase/number-field)s
- A date: use [DateField](/showcase/date-picker)
- A time zone choice: use [SelectField](/showcase/select)

## Notes

- The value is "HH:mm" on a 24-hour clock, whatever the display
- Picks commit at once, or with `confirm` wait for Done

## TimePicker: a time of day

`TimePicker` is a field that opens columns of hours, minutes, optional seconds and AM/PM in a sheet; `TimePickerPanel` is the columns on their own.

### What is it?

Scrolling columns of time parts.

### Why use it?

Tapping parts is faster and less error-prone than typing a time on a phone.

### Features

- **Clocks.** 12 or 24 hours, seconds, hours only.
- **Limits.** `minuteStep`, `min`, `max`, `isTimeDisabled`.
- **Sheet actions.** Now, Clear, confirm with Done.
- **Typed times.** `parseTypedTime` reads "2:30 pm".

## Integrating with other components

Combine with [DateField](/showcase/date-picker) for a date and time.

## Frequently asked questions

### How do I block booked slots?

Pass `isTimeDisabled`; an hour with no free minute is greyed out whole.

### Why is the value 24-hour?

One stored form; the field shows it on the clock you choose.
