## When to use

- Appointment, pickup and delivery slots kept on minute steps inside opening hours
- Recurring times of day in settings, such as a daily digest, a stand-up or a shift start
- Meeting start and end times, and a publish time set beside a chosen day

## When not to use

- A day, or a range of days, with no time of day: use [Calendar](/components/calendar) or [Date Picker](/components/date-picker)
- A duration such as "1 h 30 min" rather than a clock time: a [Number Field](/components/number-field) per unit reads better
- A booking flow with a day, a list of open slots and a confirm step: compose a [Calendar](/components/calendar) and a list of slots

## Notes

- A `value` or `defaultValue` set in code shows as given, never snapped to the steps, `min` or `max`; only picks, typing and Now snap
- On `TimePickerTrigger`, `aria-label` replaces the shown value in the accessible name: point `aria-labelledby` at a visible label instead
- Inside a right-to-left `dir` wrapper, pass `dir` to `TimePickerContent` too, because the popover portals out of the wrapper

## Time Picker: times of day, typed or picked

`TimePicker` picks a time from scrolling hour, minute and second columns, in a popover or inline, or from a field people type into. Its value is a plain `HH:mm` (or `HH:mm:ss`) string, so it stores and validates easily.

### What is Time Picker?

A set of parts around one time value: `TimePickerTrigger` opens `TimePickerContent`, whose `TimePickerColumns` show the hours, minutes, seconds and the AM/PM period. `TimePickerInput` is a typable field; `TimePickerFooter` holds Now, Clear and Confirm. Helpers parse and format times outside the UI.

### Why use Time Picker?

Native time inputs differ by browser and cannot express steps, opening hours or unavailable slots. `TimePicker` keeps the same look everywhere, snaps to a minute step, greys out unavailable times and can wait for a confirm before applying.

### Time Picker features

- **12- or 24-hour.** With or without seconds, or hours only.
- **Steps and bounds.** `minuteStep`, `min` and `max`, plus a predicate for unavailable times.
- **Typable.** `TimePickerInput` reads what people type ("9", "930", "9:30 pm").
- **Confirm before applying.** `TimePickerConfirm` commits the pick only on confirm.
- **Localised.** Labels and the period names come from the `timePicker` labels.

## Integrating with other components

Place it in a [Field](/components/field) with a label and an error. Pair it with [Date Picker](/components/date-picker) for a date and time, or with a second time picker for a start and an end, as the examples do.

## Frequently asked questions

### What format is the value?

A 24-hour string — `"09:30"`, or `"09:30:15"` with seconds — whatever the display format. Parse and format it with `parseTimeValue` and `formatTimeValue`.

### How do I limit it to opening hours?

Set `min` and `max`, and a minute step for slot length. Times outside the range are disabled in the columns.

### Can people type the time?

Yes: use `TimePickerInput`. It accepts loose input and snaps it to the step and the bounds.

### How do I show a time zone?

The picker is zone-free; show the zone beside it as a label, as the Time Zone example does, and convert when you store it.

### Is it accessible?

The columns are listboxes moved with the arrow keys; the trigger's name includes the chosen time. Name the picker through `aria-labelledby` on the trigger.
