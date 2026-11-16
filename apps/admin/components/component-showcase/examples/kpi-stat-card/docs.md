## Installation

`KpiStatCard` ships with the kit in `packages/ui/src/components/kpi-stat-card.tsx`; there is nothing to install.

```showcase-example
c-kpi-stat-card-1
```

## Usage

```tsx
import { KpiStatCard } from "@workspace/ui/components/kpi-stat-card";
```

```tsx
<KpiStatCard
	label="Revenue"
	value="RM 48,210"
	change={{ status: "change", direction: "up", sentiment: "positive", label: "+12.4%" }}
	comparisonLabel="vs last 30 days"
	icon={Wallet}
	isLoading={isLoading}
/>
```

## API Reference

```showcase-api

```

## Accessibility

- The value, the change and the comparison are text; the change's direction is in words as well as colour.
