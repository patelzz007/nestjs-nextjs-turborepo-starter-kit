## When to use

- A value picked roughly along a range: volume, brightness, a price ceiling
- A range with two ends, or several stops (`RangeSlider`)
- A value with marked points: storage tiers, months

## When not to use

- An exact number: use [NumberField](/showcase/number-field)
- A few named options: use [ToggleGroup](/showcase/toggle-group)
- Progress that people do not set: use [Progress](/showcase/progress)

## Notes

- `onChange` fires while dragging; save in `onChangeEnd`
- Screen readers step it with a swipe; `formatValue` says the value in words

## Slider: a value along a track

`Slider` picks a number by dragging a thumb, snapped to a step, with optional marks, a value bubble and a tinted track. `RangeSlider` puts several thumbs on one track.

### What is it?

A track, a filled part and a thumb.

### Why use it?

Dragging is the fastest way to a rough value.

### Features

- **Steps and bounds.** `min`, `max`, `step`.
- **Marks.** Ticks with labels.
- **Bubble.** The value above the thumb.
- **Range.** `RangeSlider` with `minDistance`.

## Integrating with other components

Pair it with a [NumberField](/showcase/number-field) when people may want an exact value.

## Frequently asked questions

### When do I save the value?

In `onChangeEnd`, once the thumb is let go; `onChange` is for showing the value live.

### Is there a vertical slider?

Not on a phone: vertical sliders fight the screen's scrolling. Use a horizontal one.
