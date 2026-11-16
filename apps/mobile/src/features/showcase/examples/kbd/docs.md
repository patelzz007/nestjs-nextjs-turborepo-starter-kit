## Installation

`Kbd` and `KbdGroup` ship with the kit in `packages/ui-native/src/components/kbd.tsx`; there is nothing to install.

```showcase-example
c-kbd-1
```

## Usage

```tsx
import { Kbd, KbdGroup } from "@workspace/ui-native/components/kbd";
```

```tsx
<Kbd label="Esc" />
<KbdGroup keys={["⌘", "K"]} accessibilityLabel="Command K" />
```

## Keys and chords

One cap, or a chord of several.

```showcase-example
c-kbd-1
```

```showcase-example
c-kbd-2
```

## Glyphs

A cap can lead with a glyph, or be only its glyph.

```showcase-example
c-kbd-3
```

## In other components

In a field, a tooltip, or a list of shortcuts.

```showcase-example
c-kbd-4
```

```showcase-example
c-kbd-5
```

```showcase-example
c-kbd-6
```

## API Reference

```showcase-api

```

## Accessibility

- `Kbd` is hidden from screen readers; name a `KbdGroup` with `accessibilityLabel`, or say the keys in the control's name or hint.
- Caps are display only: they are never pressable, so they never take a touch meant for the control beside them.
