## Installation

`Calendar` ships with the kit in `packages/ui-native/src/components/calendar.tsx`; there is nothing to install.

```showcase-example
c-calendar-1
```

## Usage

```tsx
import { Calendar } from "@workspace/ui-native/components/calendar";
```

```tsx
const [day, setDay] = React.useState<LocalDate | null>(null);

<Calendar today={today} minDate="2026-01-01" maxDate="2027-12-31" locale="en-GB" value={day} onChange={setDay} />;
```

## Modes

```showcase-example
c-calendar-2
```

```showcase-example
c-calendar-4
```

## Ruled out days

```showcase-example
c-calendar-3
```

## Navigation

```showcase-example
c-calendar-7
```

```showcase-example
c-calendar-8
```

```showcase-example
c-calendar-11
```

## Two months

```showcase-example
c-calendar-21
```

## Extras per day

```showcase-example
c-calendar-17
```

```showcase-example
c-calendar-22
```

```showcase-example
c-calendar-10
```

## In a field

```showcase-example
c-calendar-24
```

```showcase-example
c-calendar-29
```

## API Reference

```showcase-api

```

## Accessibility

- Each day is a button named by its full date, whether it is today, its place in the selection and what `describeDay` adds ("Sunday 15 November 2026, today, selected, $89 a night").
- Ruled out days are disabled, so screen readers say so and taps do nothing.
- The header's month steps are named "Previous month" and "Next month"; the month and year buttons say they open lists.
- Week numbers and day footers are hidden from screen readers: the day's name carries what they say.
- The second month's title is a header.
