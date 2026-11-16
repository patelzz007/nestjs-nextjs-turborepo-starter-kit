## When to use

- Settings tuned by dragging along a bounded scale, such as volume, opacity or colour temperature
- Ranges picked with two or more thumbs on one track, horizontal or vertical
- Durations, sizes and scores read off tick marks, scale labels, a value bubble or an emoji

## When not to use

- A value typed straight into a box, such as an exact price, with no scale to drag: use [Number Field](/components/number-field) or [Input](/components/input)
- A read-only bar reporting how far a task or upload has got: use [Progress](/components/progress)

## Notes

- `Slider` draws one thumb per entry of an array `value` or `defaultValue`, and one thumb for a plain number; with neither, it draws a two-thumb range
- A `Label`'s `htmlFor` reaches only the slider's root, not its thumb input: name the slider with `aria-labelledby`
- `onValueChange` receives a number for one thumb and an array for several

## Slider: values and ranges by dragging

`Slider` picks a number, or a range with several thumbs, along a track. It is built on Base UI's slider: the thumbs move by pointer and by keyboard, values snap to `step`, and each thumb is a real range input for assistive technology.

### What is Slider?

A track with one or more thumbs between `min` and `max`. One thumb picks a value (volume); two pick a range (a price filter). It lays out horizontally or vertically.

### Why use Slider?

When the exact number matters less than the feel — brightness, a price range, an estimate — dragging is faster than typing and shows where the value sits within its bounds.

### Slider features

- **One or many thumbs.** An array value draws a thumb per entry.
- **Steps and bounds.** `min`, `max`, `step`, and `minStepsBetweenValues` for ranges.
- **Vertical.** `orientation="vertical"`.
- **Sizes and states.** `sm`, `default`, `lg`; `disabled`, `aria-invalid`.
- **Composable extras.** Tick marks, labels, tooltips and a linked number input, as the examples show.

## Integrating with other components

Pair a slider with a [Number Field](/components/number-field) for an exact value, show the value in a [Tooltip](/components/tooltip) over the thumb, and put it in a [Field](/components/field) for its label.

## Frequently asked questions

### Slider or numeric input?

A slider when the range matters and precision does not; a [Number Field](/components/number-field) when people know the exact number. Both together suit settings such as "max price".

### How do I make a range slider?

Pass an array of two values: `defaultValue={[20, 80]}`. Set `minStepsBetweenValues` to stop the thumbs crossing.

### Is it keyboard-accessible?

Yes: each thumb is focusable; the arrow keys step it, Page Up / Page Down step by ten, Home and End jump to the bounds.

### Does it work on touch screens?

Yes: the thumbs are large enough to drag with a finger and the track can be tapped to jump.
