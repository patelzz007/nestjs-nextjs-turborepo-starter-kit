## Installation

`MultiDateField` ships with the kit in `packages/ui-native/src/components/multi-date-field.tsx`; there is nothing to install.

```showcase-example
c-multi-date-picker-1
```

## Usage

```tsx
import { MultiDateField } from "@workspace/ui-native/components/multi-date-field";
```

```tsx
const [days, setDays] = React.useState<readonly LocalDate[]>([]);

<MultiDateField label="Holidays" today={today} minDate={today} maxDate="2027-12-31" locale="en-GB" value={days} onChange={setDays} maxDates={5} placeholder="Pick days" />;
```

## API Reference

```showcase-api

```

## Accessibility

- The field is a button named by its label and the picked days, and its hint says it opens the calendar.
- Each day is a button named by its full date and whether it is picked.
- At the limit, the unpicked days are disabled, so screen readers say why they cannot be picked.
