## Installation

`Switch` ships with the kit in `packages/ui/src/components/switch.tsx`, built on Base UI's switch; there is nothing to install.

```showcase-example
c-switch-1
```

## Usage

```tsx
import { Switch } from "@workspace/ui/components/switch";
```

```tsx
<div className="flex items-center gap-2">
	<Switch id="notifications" checked={enabled} onCheckedChange={save} />
	<Label htmlFor="notifications">Email notifications</Label>
</div>
```

## Examples

### With a description

```showcase-example
c-switch-2
```

### Sizes

```showcase-example
c-switch-4
```

### Group in a card

```showcase-example
c-switch-6
```

### Destructive confirm

```showcase-example
c-switch-12
```

## API Reference

```showcase-api

```

## Keyboard

| Key             | Action            |
| :-------------- | :---------------- |
| `Space` `Enter` | Flips the switch. |

## Accessibility

- It renders `role="switch"` with `aria-checked`, plus a hidden native input for forms.
- Name it with a `Label` tied by `htmlFor`; link a description with `aria-describedby`.
