## Installation

`KpiStatCard` ships with the kit in `packages/ui-native/src/components/kpi-stat-card.tsx`; there is nothing to install.

```showcase-example
c-kpi-stat-card-1
```

## Usage

```tsx
import { KpiStatCard } from "@workspace/ui-native/components/kpi-stat-card";
```

```tsx
<KpiStatCard
	label="Revenue"
	value="RM 48,210"
	change={{ status: "change", direction: "up", sentiment: "positive", label: "+12.4%" }}
	comparisonLabel="vs the previous 30 days"
/>
```

## API Reference

```showcase-api

```

## Accessibility

- The card is one element: its label, value and the change in words.
- While loading it is announced busy.
