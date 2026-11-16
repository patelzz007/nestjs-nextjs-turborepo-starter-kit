## When to use

- Brand, accent and theme-token settings stored as a hex, rgb, hsl or oklch string
- Label, text and highlight colours chosen from a fixed palette of named presets
- Design and drawing tools: fill and stroke inspectors, brush pickers, contrast checks and shade scales

## When not to use

- A choice between a few named colours with no custom value: a [Radio Group](/components/radio-group) or [Toggle Group](/components/toggle-group) of swatches is simpler
- A theme switch between light and dark: use a [Toggle Group](/components/toggle-group)

## Notes

- `ColorPicker` renders no wrapper element: with no children it draws its own trigger and popover; with children, they lay out in the parent
- A value in any syntax `parseColor` reads is accepted, but the next change comes back written in the root `format`
- Without `alpha`, opacity in a passed value is ignored and every value the picker emits is opaque

## Color Picker: area, sliders, wheel, swatches and fields

`ColorPicker` picks a colour from a saturation area, hue and alpha sliders, a hue wheel, preset swatches or typed values — in HEX, RGB, HSL or OKLCH. On its own it renders a trigger button that opens the full panel; composed, its parts build anything from a swatch row to a design-tool inspector.

### What is Color Picker?

A set of parts sharing one colour state: `ColorPickerArea`, `ColorPickerSlider` (any channel, in any colour space), `ColorPickerWheel`, `ColorPickerSwatches`, `ColorPickerFields`, `ColorPickerInput`, plus actions for copying, clearing and sampling from the screen with the EyeDropper. Helpers — `parseColor`, `formatColor`, `getContrastRatio`, `getForegroundColor` — work without the UI.

### Why use Color Picker?

Theme settings and design tools need more than `<input type="color">`: opacity, wide-gamut OKLCH, presets, typed values and contrast checks. `ColorPicker` covers them with one state, keyboard-operable parts and a value written in the format you store.

### Color Picker features

- **Formats.** HEX, RGB, HSL and OKLCH, with optional alpha; the emitted value follows `format`.
- **Many surfaces.** Area, channel sliders, hue wheel, swatches, fields and a typable input.
- **Popover or inline.** `ColorPickerContent` in a popover, or `ColorPickerPanel` straight in a page.
- **Actions.** Copy, clear and EyeDropper sampling where the browser supports it.
- **Helpers.** Parse, format, contrast ratio and best foreground colour.

## Integrating with other components

Put it in a [Field](/components/field) with a label, as the popover example does. Use `ColorPickerSwatches` in a [Popover](/components/popover) for a label-colour menu, and the contrast helpers to warn when a text colour fails on its background.

## Frequently asked questions

### Which formats can it read and write?

It reads any CSS colour `parseColor` understands — hex, named colours, `rgb()`, `hsl()`, `oklch()` — and writes the next change in the root's `format`.

### How do I allow transparency?

Pass `alpha`, then add a `ColorPickerSlider channel="alpha"` or use the default panel, which includes it.

### Can I check contrast?

Yes: `getContrastRatio(foreground, background)` returns the WCAG ratio, and `getForegroundColor(background)` picks light or dark text.

### Does the EyeDropper work everywhere?

Only where the browser provides the EyeDropper API (Chromium today). `ColorPickerEyeDropper` renders nothing elsewhere.

### Is it accessible?

Every surface is keyboard-operable: the area is announced as one slider, sliders and the wheel move with the arrow keys, swatches are a listbox with a single tab stop.
