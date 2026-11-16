## Installation

`Separator` ships with the kit in `packages/ui/src/components/separator.tsx`, built on Base UI's separator; there is nothing to install.

```showcase-example
c-separator-1
```

## Usage

```tsx
import { Separator } from "@workspace/ui/components/separator";
```

```tsx
<Separator />

<div className="flex h-5 items-center gap-3">
	<span>Docs</span>
	<Separator orientation="vertical" />
	<span>Blog</span>
</div>
```

## Examples

### Vertical

```showcase-example
c-separator-2
```

### Centered label

```showcase-example
c-separator-5
```

## API Reference

```showcase-api

```

## Accessibility

- `role="separator"` with `aria-orientation`; hide purely decorative rules with `aria-hidden`.
