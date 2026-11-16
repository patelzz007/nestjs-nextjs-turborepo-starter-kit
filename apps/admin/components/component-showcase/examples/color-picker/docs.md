## Installation

The colour picker parts ship with the kit in `packages/ui/src/components/color-picker.tsx` and the files beside it; there is nothing to install.

```showcase-example
c-color-picker-1
```

## Usage

```tsx
import { ColorPicker } from "@workspace/ui/components/color-picker";
```

With no children it renders a trigger that opens the full panel:

```tsx
<ColorPicker id="accent" value={accent} onValueChange={setAccent} format="hex" />
```

Composed, it can be any arrangement of its parts:

```tsx
<ColorPicker value={color} onValueChange={setColor} alpha>
	<ColorPickerTrigger />
	<ColorPickerContent>
		<ColorPickerPanel>
			<ColorPickerArea />
			<ColorPickerSlider channel="hue" />
			<ColorPickerSlider channel="alpha" />
			<ColorPickerFields />
			<ColorPickerSwatches colors={["#ef4444", "#22c55e", "#3b82f6"]} />
		</ColorPickerPanel>
	</ColorPickerContent>
</ColorPicker>
```

## Examples

### Popover in a field

```showcase-example
c-color-picker-2
```

### Typable input

```showcase-example
c-color-picker-3
```

### Opacity

```showcase-example
c-color-picker-4
```

### Preset swatches

```showcase-example
c-color-picker-5
```

### OKLCH theme token

```showcase-example
c-color-picker-6
```

### Contrast checker

```showcase-example
c-color-picker-13
```

## API Reference

```showcase-api

```

## Accessibility

- The saturation area is one slider to assistive technology, with the arrow keys moving both axes; each channel slider and the wheel are sliders of their own.
- `ColorPickerSwatches` is a listbox with one tab stop; the arrow keys move between presets and Enter picks one.
- The trigger's name includes the current value, so it reads "Accent colour #0EA5E9" rather than the label alone.
