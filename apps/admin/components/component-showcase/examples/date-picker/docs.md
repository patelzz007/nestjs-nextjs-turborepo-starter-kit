## Installation

`DatePicker` ships with the kit in `packages/ui/src/components/date-picker.tsx`; there is nothing to install. It composes the kit's `Popover` and `Calendar`.

```showcase-example
c-date-picker-1
```

## Usage

```tsx
import { DatePicker } from "@workspace/ui/components/date-picker";
```

```tsx
<Label htmlFor="due-date">Due date</Label>
<DatePicker id="due-date" value={dueDate} onValueChange={setDueDate} fromDate="2026-01-01" />
```

## API Reference

```showcase-api

```

## Accessibility

- The trigger is a button; name it with a `Label` tied by `htmlFor`.
- The calendar inside is keyboard-operable (arrow keys, Page Up / Page Down), and Escape closes the popover.
