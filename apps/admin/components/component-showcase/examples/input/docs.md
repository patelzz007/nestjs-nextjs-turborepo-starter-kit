## Installation

`Input` ships with the kit in `packages/ui/src/components/input.tsx`; there is nothing to install. It is built on Base UI's input.

```showcase-example
c-input-1
```

## Usage

```tsx
import { Input } from "@workspace/ui/components/input";
```

```tsx
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" autoComplete="email" aria-invalid={isInvalid} />
```

`inputVariants`, also exported from `@workspace/ui/components/input`, gives the same look to a field that cannot be an `Input`.

## Examples

### With a description

```showcase-example
c-input-3
```

### Error message

```showcase-example
c-input-5
```

### Character counter

```showcase-example
c-input-6
```

### Native types

```showcase-example
c-input-12
```

## API Reference

```showcase-api

```

## Accessibility

- `Input` is a native `input`, named by a `Label` tied with `htmlFor`.
- `aria-invalid` both styles the error and announces it; link the message with `aria-describedby`.
- `disabled` removes the field from the tab order; `readOnly` keeps it focusable and readable.
