## Installation

The chart parts ship with the kit in `packages/ui/src/components/chart.tsx`, built on `recharts`, already installed.

```showcase-example
c-chart-1
```

## Usage

```tsx
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart";
```

```tsx
const CONFIG = {
	revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

<ChartContainer config={CONFIG} className="h-64 w-full">
	<BarChart accessibilityLayer data={monthly}>
		<CartesianGrid vertical={false} />
		<XAxis dataKey="month" tickLine={false} axisLine={false} />
		<ChartTooltip content={<ChartTooltipContent />} />
		<Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
	</BarChart>
</ChartContainer>;
```

## Examples

### Multi-dataset bars

```showcase-example
c-chart-2
```

### Gradient area

```showcase-example
c-chart-13
```

### Forecast line

```showcase-example
c-chart-17
```

### Donut with a centre total

```showcase-example
c-chart-19
```

## API Reference

```showcase-api

```

## Accessibility

- Give each chart a visible title and a text summary; offer the data as a table where it matters.
- `accessibilityLayer` on the Recharts chart lets keyboard users move between data points.
