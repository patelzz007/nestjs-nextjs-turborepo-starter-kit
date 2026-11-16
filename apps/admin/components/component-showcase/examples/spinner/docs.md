## Installation

`Spinner` ships with the kit in `packages/ui/src/components/spinner.tsx`; there is nothing to install.

```showcase-example
c-spinner-1
```

## Usage

```tsx
import { Spinner } from "@workspace/ui/components/spinner";
```

```tsx
<Spinner className="size-5 text-muted-foreground" />
```

## Examples

### In badges

```showcase-example
c-spinner-3
```

### In an input group

```showcase-example
c-spinner-4
```

### Card overlay

```showcase-example
c-spinner-11
```

## API Reference

```showcase-api

```

## Accessibility

- `role="status"` with a localised "Loading" name; `aria-hidden` when the surrounding text says the same.
