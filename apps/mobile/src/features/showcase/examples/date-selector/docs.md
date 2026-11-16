## Installation

`DateSelector` and `DateSelectorField` ship with the kit in `packages/ui-native/src/components/date-selector.tsx`; there is nothing to install.

```showcase-example
c-date-selector-1
```

## Usage

```tsx
import { DateSelectorField } from "@workspace/ui-native/components/date-selector";
import type { DateSelectorValue } from "@workspace/ui-native/lib/date-selector";
```

```tsx
const [value, setValue] = React.useState<DateSelectorValue>({ period: "month", operator: "is" });

<DateSelectorField label="Period" today={today} minYear={2020} maxYear={2030} locale="en-GB" value={value} onChange={setValue} />;
```

## In a sheet

```showcase-example
c-date-selector-2
```

## In a dialog

```showcase-example
c-date-selector-3
```

## Another language

```showcase-example
c-date-selector-4
```

## API Reference

```showcase-api

```

## Accessibility

- The filter and period tabs are radio groups named "Filter" and "Period".
- Each month, quarter, half and year is a button named in full ("November 2026") and marked selected when picked or inside a range.
- The year steps are named "Previous year" and "Next year", and are disabled at the ends.
- A typed entry that cannot be read shows an alert saying what to type.
- The field is a button named by its label and the value ("Reporting period, Is Q4 2026").
