## Installation

`DateField` ships with the kit in `packages/ui-native/src/components/date-field.tsx`; there is nothing to install.

```showcase-example
c-date-picker-1
```

## Usage

```tsx
import { DateField } from "@workspace/ui-native/components/date-field";
```

```tsx
const [day, setDay] = React.useState<LocalDate | null>(null);

<DateField label="Due date" today={today} minDate={today} maxDate="2027-12-31" locale="en-GB" value={day} onChange={setDay} placeholder="Pick a date" />;
```

## API Reference

```showcase-api

```

## Accessibility

- The field is a button named by its label and the picked day ("Due date, 15 November 2026"), and its hint says it opens the calendar.
- Opening the sheet is the field's focus and closing it its blur, so a form marks it touched.
- Each day is a button named by its full date; days outside the bounds are disabled.
- An error message is announced as it appears.
