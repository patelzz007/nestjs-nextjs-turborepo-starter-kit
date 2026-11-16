## Installation

`StatusBadge` ships with the kit in `packages/ui/src/components/status-badge.tsx`; there is nothing to install.

```showcase-example
c-status-badge-1
```

## Usage

```tsx
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
```

```tsx
const MERCHANT_STATUS: Record<MerchantStatus, { tone: StatusTone; label: string }> = {
	active: { tone: "success", label: "Active" },
	suspended: { tone: "danger", label: "Suspended" },
	pending: { tone: "warning", label: "Pending" },
};

<StatusBadge tone={MERCHANT_STATUS[status].tone}>{MERCHANT_STATUS[status].label}</StatusBadge>;
```

## API Reference

```showcase-api

```

## Accessibility

- The status is text; the tone is colour on top of it.
