## Installation

`Slider` ships with the kit in `packages/ui/src/components/slider.tsx`, built on Base UI's slider; there is nothing to install.

```showcase-example
c-slider-1
```

## Usage

```tsx
import { Slider } from "@workspace/ui/components/slider";
```

```tsx
<Slider aria-labelledby="volume-label" defaultValue={50} max={100} step={1} />

<Slider aria-label="Price range" value={range} onValueChange={setRange} min={0} max={500} />
```

## Examples

### Range

```showcase-example
c-slider-6
```

### Vertical

```showcase-example
c-slider-4
```

### Linked number input

```showcase-example
c-slider-7
```

### Tick marks

```showcase-example
c-slider-10
```

## API Reference

```showcase-api

```

## Keyboard

| Key                   | Action                             |
| :-------------------- | :--------------------------------- |
| `←` `→` / `↑` `↓`     | Steps the focused thumb by `step`. |
| `Page Up` `Page Down` | Steps by a larger amount.          |
| `Home` `End`          | Moves to `min` or `max`.           |

## Accessibility

- Each thumb wraps a native range input with its value, minimum and maximum exposed.
- Name the slider with `aria-labelledby` or `aria-label`; a `Label`'s `htmlFor` reaches only the root, not the thumb inputs.
