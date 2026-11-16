## Installation

`ColorPicker` ships with the kit in `packages/ui-native/src/components/color-picker.tsx`; there is nothing to install.

```showcase-example
c-color-picker-1
```

## Usage

```tsx
import { ColorPicker, ColorPickerField } from "@workspace/ui-native/components/color-picker";
```

```tsx
<ColorPickerField label="Brand colour" value={color} onChange={setColor} />
```

## The panel

All the parts together.

```showcase-example
c-color-picker-1
```

## A field

Opens the panel in a sheet.

```showcase-example
c-color-picker-2
```

## Your own layout

Parts and helpers.

```showcase-example
c-color-picker-11
```

```showcase-example
c-color-picker-13
```

## API Reference

```showcase-api

```

## Accessibility

- The area and sliders are adjustable and say their values.
- Swatches are named ("Ocean blue") and report selected.
