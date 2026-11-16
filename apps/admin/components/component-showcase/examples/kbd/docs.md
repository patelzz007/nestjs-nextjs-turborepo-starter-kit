## Installation

`Kbd` and `KbdGroup` ship with the kit in `packages/ui/src/components/kbd.tsx`; there is nothing to install.

```showcase-example
c-kbd-1
```

## Usage

```tsx
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";
```

```tsx
<Kbd>Esc</Kbd>

<KbdGroup>
	<Kbd>⌘</Kbd>
	<Kbd>K</Kbd>
</KbdGroup>
```

## Examples

### Grouped keys

```showcase-example
c-kbd-2
```

### Inside an input

```showcase-example
c-kbd-4
```

### In a tooltip

Inside a tooltip the caps switch to the tooltip's colours on their own.

```showcase-example
c-kbd-5
```

## API Reference

```showcase-api

```

## Accessibility

- `Kbd` renders `<kbd>` and `KbdGroup` a `<kbd>` of `<kbd>`s, so assistive technology reads the keys as text in their place.
- The caps are inert (`pointer-events: none`, no selection), so they never take a click meant for the control around them. Keep the action itself labelled in words; the hint only adds to it.
