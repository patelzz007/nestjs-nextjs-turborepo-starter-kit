## Installation

`Label` ships with the kit in `packages/ui/src/components/label.tsx`; there is nothing to install.

```showcase-example
c-label-1
```

## Usage

```tsx
import { Label } from "@workspace/ui/components/label";
```

```tsx
const id = React.useId();

<Label htmlFor={id}>Email</Label>
<Input id={id} type="email" />
```

## Examples

### Required and optional

```showcase-example
c-label-5
```

```showcase-example
c-label-6
```

### With a checkbox

```showcase-example
c-label-2
```

### Error state

```showcase-example
c-label-11
```

## API Reference

```showcase-api

```

## Accessibility

- `Label` is a native `label`: with `htmlFor` it names its control and clicking it focuses or toggles the control.
- Keep the visible text and the accessible name the same, so voice-control users can say what they see.
