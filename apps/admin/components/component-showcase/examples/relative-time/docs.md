## Installation

`RelativeTime` ships with the kit in `packages/ui/src/components/relative-time.tsx`; there is nothing to install.

```showcase-example
c-relative-time-1
```

## Usage

```tsx
import { RelativeTime } from "@workspace/ui/components/relative-time";
```

```tsx
<RelativeTime epochMs={order.createdAtEpochMs} region={displayRegion} />
```

## API Reference

```showcase-api

```

## Accessibility

- A `time` element with the exact `dateTime`; its `title` shows the exact time on hover (a native tooltip does not appear on keyboard focus).
