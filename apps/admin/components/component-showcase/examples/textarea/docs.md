## Installation

`Textarea` ships with the kit in `packages/ui/src/components/textarea.tsx`; there is nothing to install.

```showcase-example
c-textarea-1
```

## Usage

```tsx
import { Textarea } from "@workspace/ui/components/textarea";
```

```tsx
<Label htmlFor="bio">Bio</Label>
<Textarea id="bio" maxLength={280} className="max-h-48" />
```

## Examples

### With a description

```showcase-example
c-textarea-4
```

### Invalid

```showcase-example
c-textarea-2
```

### Auto-resize with a counter

```showcase-example
c-textarea-6
```

## API Reference

```showcase-api

```

## Accessibility

- `Textarea` is a native `textarea`: name it with a `Label` tied by `htmlFor`.
- `aria-invalid` styles and announces an error; link the message with `aria-describedby`.
