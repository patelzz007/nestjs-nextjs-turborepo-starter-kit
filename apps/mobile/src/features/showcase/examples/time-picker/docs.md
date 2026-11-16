## Installation

`TimePicker` ships with the kit in `packages/ui-native/src/components/time-picker.tsx`; there is nothing to install.

```showcase-example
c-time-picker-2
```

## Usage

```tsx
import { TimePicker, TimePickerPanel } from "@workspace/ui-native/components/time-picker";
```

```tsx
<TimePicker label="Start" value={start} onChange={setStart} minuteStep={15} />
```

## Field and panel

In a sheet, or always open.

```showcase-example
c-time-picker-2
```

```showcase-example
c-time-picker-1
```

## Limits

Bounds and booked slots.

```showcase-example
c-time-picker-6
```

```showcase-example
c-time-picker-7
```

## Confirming

A draft until Done.

```showcase-example
c-time-picker-10
```

## API Reference

```showcase-api

```

## Accessibility

- Each cell is named with its column ("04, Hours").
- Greyed-out times are disabled for screen readers too.
