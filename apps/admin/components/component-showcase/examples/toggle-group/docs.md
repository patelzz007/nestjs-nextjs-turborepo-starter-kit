## Installation

`ToggleGroup` and `ToggleGroupItem` ship with the kit in `packages/ui/src/components/toggle-group.tsx`; there is nothing to install. They are built on Base UI's toggle group.

```showcase-example
c-toggle-group-1
```

## Usage

```tsx
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
```

```tsx
<ToggleGroup aria-label="Text alignment" value={alignment} onValueChange={setAlignment}>
	<ToggleGroupItem value="left" aria-label="Align left">
		<AlignLeft />
	</ToggleGroupItem>
	<ToggleGroupItem value="center" aria-label="Align centre">
		<AlignCenter />
	</ToggleGroupItem>
</ToggleGroup>
```

`value` is an array of the pressed items' values, with one entry at most unless `multiple` is set.

## Spacing

The default `spacing` leaves a gap between items; `spacing={0}` joins them into one segmented control.

```showcase-example
c-toggle-group-4
```

## Examples

### Outline

```showcase-example
c-toggle-group-2
```

### Vertical

```showcase-example
c-toggle-group-6
```

### View mode

```showcase-example
c-toggle-group-8
```

## API Reference

```showcase-api

```

## Keyboard

| Key               | Action                                                            |
| :---------------- | :---------------------------------------------------------------- |
| `Tab`             | Moves focus into the group, to the pressed item or the first one. |
| `←` `→` / `↑` `↓` | Moves between items, by `orientation`.                            |
| `Enter` `Space`   | Presses or releases the focused item.                             |

## Accessibility

- The group renders `role="group"`; name it with `aria-label`. Each item is a button with `aria-pressed`.
- Focus roves between items, so the group is a single tab stop.
