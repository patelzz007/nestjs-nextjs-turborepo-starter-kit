## Installation

`Switch` ships with the kit in `packages/ui-native/src/components/switch.tsx`; there is nothing to install.

```showcase-example
c-switch-3
```

## Usage

```tsx
import { Switch } from "@workspace/ui-native/components/switch";
```

```tsx
<Switch label="Push notifications" checked={push} onChange={setPush} />
```

## States

Disabled and sizes.

```showcase-example
c-switch-3
```

```showcase-example
c-switch-4
```

## Lists

Rows with icons and separators.

```showcase-example
c-switch-7
```

```showcase-example
c-switch-8
```

## Destructive

A setting that wipes data.

```showcase-example
c-switch-12
```

## API Reference

```showcase-api

```

## Accessibility

- Announced as a switch, on or off, named by its label.
- The whole row is the touch target.
