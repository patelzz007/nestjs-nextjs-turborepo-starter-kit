## When to use

- Picking a colour by eye: a brand colour, a label's colour, a highlight
- Typing an exact colour in hex, rgb(), hsl() or oklch()
- Offering preset swatches with a custom fallback

## When not to use

- Choosing between a few named colours only: use swatches (`ColorPickerSwatch`) or a [ToggleGroup](/showcase/toggle-group)
- Theme choice (light, dark): use the app's appearance settings
- A colour that must meet contrast rules: check it with `contrastRatio` before saving

## Notes

- The value is hex (`#3b82f6`, or `#3b82f680` when see-through)
- The colours drawn are the colour being picked; everything around them is theme tokens

## ColorPicker: a colour, by eye or by value

`ColorPicker` sets out an area for saturation and brightness, a hue slider, an optional opacity slider, a typed value and preset swatches. Each part is its own component, and `ColorPickerField` opens them in a sheet.

### What is it?

Parts that each move one aspect of a colour.

### Why use it?

Designers pick by eye; developers paste values. The picker serves both.

### Features

- **Area and sliders.** Dragged, or stepped by screen readers.
- **Formats.** Hex, rgb, hsl, oklch.
- **Swatches.** Presets and recent colours.
- **Field.** `ColorPickerField`, full or compact.
- **Maths.** `lib/color.ts`: conversions, contrast, gamut.

## Integrating with other components

Check text on a picked colour with `contrastRatio` from `@workspace/ui-native/lib/color`.

## Frequently asked questions

### Which format does it report?

Always hex. Show other formats with `formatColor`, or let people type them in `ColorPickerInput`.

### Is it accessible?

The area and sliders are adjustable controls; swipes move them a step. The typed value is the precise way.
