## Installation

`MultiDatePicker` ships with the kit in `packages/ui/src/components/multi-date-picker.tsx`; there is nothing to install.

```showcase-example
c-multi-date-picker-1
```

## Usage

```tsx
import { MultiDatePicker } from "@workspace/ui/components/multi-date-picker";
```

```tsx
<Label htmlFor="blackout-days">Blackout days</Label>
<MultiDatePicker id="blackout-days" value={days} onValueChange={setDays} maxDates={10} />
```

## API Reference

```showcase-api

```

## Accessibility

- The trigger is a button named by its label, and its text lists the chosen days.
- The calendar is keyboard-operable, and selected days are announced as selected.
