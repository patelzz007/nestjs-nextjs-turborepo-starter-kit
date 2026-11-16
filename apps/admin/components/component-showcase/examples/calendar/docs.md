## Installation

`Calendar` ships with the kit in `packages/ui/src/components/calendar.tsx`, built on `react-day-picker` and `date-fns`, both already installed.

```showcase-example
c-calendar-1
```

## Usage

```tsx
import { Calendar } from "@workspace/ui/components/calendar";
```

```tsx
<Calendar mode="single" selected={date} onSelect={setDate} />

<Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />
```

## Examples

### Range

```showcase-example
c-calendar-2
```

### Disabled dates

```showcase-example
c-calendar-3
```

### Month and year dropdowns

```showcase-example
c-calendar-8
```

### Time slots

```showcase-example
c-calendar-14
```

### Date presets

```showcase-example
c-calendar-15
```

### Date picker in a popover

```showcase-example
c-calendar-24
```

## API Reference

```showcase-api

```

## Keyboard

| Key                             | Action                                 |
| :------------------------------ | :------------------------------------- |
| `←` `→` `↑` `↓`                 | Moves by a day or a week.              |
| `Page Up` `Page Down`           | Moves by a month.                      |
| `Shift` + `Page Up` `Page Down` | Moves by a year.                       |
| `Home` `End`                    | Moves to the start or end of the week. |
| `Enter` `Space`                 | Selects the focused day.               |

## Accessibility

- The month is a `grid` of day buttons; the selected, today and disabled states are announced.
- The navigation buttons are named ("Go to the previous month").
