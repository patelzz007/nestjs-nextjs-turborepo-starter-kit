## Installation

`StatusBadge` ships with the kit in `packages/ui-native/src/components/status-badge.tsx`; there is nothing to install.

```showcase-example
c-status-badge-1
```

## Usage

```tsx
import { StatusBadge } from "@workspace/ui-native/components/status-badge";
```

```tsx
<StatusBadge tone="success" icon={CircleCheckIcon} label="Active" accessibilityLabel="Active" />
```

## API Reference

```showcase-api

```

## Accessibility

- It reads as one piece of text, named by `accessibilityLabel`.
- Pulsing stops under Reduce Motion.
