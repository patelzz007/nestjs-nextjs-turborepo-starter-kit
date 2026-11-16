## Installation

`Toggle` ships with the kit in `packages/ui/src/components/toggle.tsx`; there is nothing to install. It is built on Base UI's toggle primitive.

```showcase-example
c-toggle-1
```

## Usage

```tsx
import { Toggle } from "@workspace/ui/components/toggle";
```

```tsx
<Toggle aria-label="Bold" pressed={isBold} onPressedChange={setIsBold}>
	<Bold />
</Toggle>
```

`toggleVariants` returns the same classes for a control that cannot be a `Toggle`.

## Variants and sizes

`variant` is `default` or `outline`; `size` is `sm`, `default` or `lg`.

```showcase-example
c-toggle-2
```

```showcase-example
c-toggle-8
```

## Examples

### Icon and label swap

```showcase-example
c-toggle-9
```

### Reactions with a count

```showcase-example
c-toggle-11
```

## API Reference

```showcase-api

```

## Keyboard

| Key             | Action                     |
| :-------------- | :------------------------- |
| `Tab`           | Moves focus to the toggle. |
| `Enter` `Space` | Presses or releases it.    |

## Accessibility

- `Toggle` renders a native `button` with `aria-pressed`, so assistive technology announces it as a toggle button with its state.
- An icon-only toggle needs an `aria-label`; it wins over any visible text, so keep the two in step.
- `loading` and `disabled` both disable the toggle and take it out of the tab order.
