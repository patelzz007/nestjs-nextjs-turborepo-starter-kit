## Installation

`Progress` ships with the kit in `packages/ui-native/src/components/progress.tsx`; there is nothing to install.

```showcase-example
c-progress-1
```

## Usage

```tsx
import { Progress } from "@workspace/ui-native/components/progress";
```

```tsx
<Progress value={64} label="Uploading invoice.pdf" showValue accessibilityLabel="Uploading invoice.pdf" />
```

## Sizes

```showcase-example
c-progress-2
```

```showcase-example
c-progress-3
```

## File uploads

```showcase-example
c-progress-5
```

## Multi-step

```showcase-example
c-progress-7
```

## API Reference

```showcase-api

```

## Accessibility

- It is a progress bar with its minimum, maximum and current value (or `valueText`).
- Loading is announced as busy.
- The fill's motion follows Reduce Motion.
