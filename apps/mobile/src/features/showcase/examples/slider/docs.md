## Installation

`Slider` ships with the kit in `packages/ui-native/src/components/slider.tsx`; there is nothing to install.

```showcase-example
c-slider-6
```

## Usage

```tsx
import { Slider } from "@workspace/ui-native/components/slider";
import { RangeSlider } from "@workspace/ui-native/components/range-slider";
```

```tsx
<Slider value={volume} onChange={setVolume} onChangeEnd={saveVolume} accessibilityLabel="Volume" />
```

## Ranges

Two or more thumbs.

```showcase-example
c-slider-6
```

```showcase-example
c-slider-3
```

## Marks

Ticks and labels.

```showcase-example
c-slider-9
```

```showcase-example
c-slider-10
```

## Showing the value

A bubble, or a field beside it.

```showcase-example
c-slider-11
```

```showcase-example
c-slider-7
```

## API Reference

```showcase-api

```

## Accessibility

- Adjustable: swipe up or down to step; each RangeSlider thumb is its own control.
- `formatValue` gives the spoken value ("60%").
