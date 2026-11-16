## Installation

`Badge` ships with the kit in `packages/ui/src/components/badge.tsx`; there is nothing to install.

```showcase-example
c-badge-1
```

## Usage

```tsx
import { Badge } from "@workspace/ui/components/badge";
```

```tsx
<Badge variant="success-light">Active</Badge>
<Badge variant="secondary" radius="full">3</Badge>
```

`badgeVariants` gives the same classes to an element that cannot be a `Badge`.

## Examples

### Light tones

```showcase-example
c-badge-15
```

### Outline tones

```showcase-example
c-badge-11
```

### Sizes

```showcase-example
c-badge-18
```

### Status dot

```showcase-example
c-badge-22
```

### Dismiss button

```showcase-example
c-badge-21
```

### As a link

```showcase-example
c-badge-23
```

## API Reference

```showcase-api

```

## Accessibility

- A badge is text: its words must carry the meaning, with colour as an addition.
- A badge link or a remove button is interactive and needs a clear accessible name.
