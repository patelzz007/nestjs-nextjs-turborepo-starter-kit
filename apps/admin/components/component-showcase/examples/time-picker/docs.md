## Installation

The time picker parts ship with the kit in `packages/ui/src/components/time-picker.tsx` and the files beside it; there is nothing to install.

```showcase-example
c-time-picker-1
```

## Usage

```tsx
import {
	TimePicker,
	TimePickerClear,
	TimePickerColumns,
	TimePickerConfirm,
	TimePickerContent,
	TimePickerFooter,
	TimePickerNow,
	TimePickerTrigger,
} from "@workspace/ui/components/time-picker";
```

```tsx
<TimePicker value={time} onValueChange={setTime}>
	<TimePickerTrigger aria-labelledby="time-label" />
	<TimePickerContent>
		<TimePickerColumns />
		<TimePickerFooter>
			<TimePickerNow />
			<TimePickerClear />
			<TimePickerConfirm />
		</TimePickerFooter>
	</TimePickerContent>
</TimePicker>
```

## Examples

### Popover picker

```showcase-example
c-time-picker-2
```

### Typable input

```showcase-example
c-time-picker-3
```

### 12-hour clock with seconds

```showcase-example
c-time-picker-4
```

### Opening hours

```showcase-example
c-time-picker-6
```

### Unavailable slots

```showcase-example
c-time-picker-7
```

### Start and end

```showcase-example
c-time-picker-8
```

### Confirm before applying

```showcase-example
c-time-picker-10
```

### Date and time

```showcase-example
c-time-picker-13
```

## API Reference

```showcase-api

```

## Accessibility

- Each column is a listbox: the arrow keys move through its values and the selected one is announced.
- The trigger's accessible name includes the chosen time; give it a visible label through `aria-labelledby` rather than an `aria-label`, which would replace the time.
- Unavailable times are disabled options, announced as such and skipped by the keyboard.
