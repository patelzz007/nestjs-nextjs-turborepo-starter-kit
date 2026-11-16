## Installation

`Chart` ships with the kit in `packages/ui-native/src/components/chart.tsx`; there is nothing to install.

```showcase-example
c-chart-1
```

## Usage

```tsx
import { BarChart, type ChartSeries } from "@workspace/ui-native/components/chart";
```

```tsx
const SERIES: readonly ChartSeries[] = [{ key: "desktop", label: "Desktop", color: "chart-1" }];

<BarChart data={[{ label: "Jan", values: { desktop: 300 } }]} series={SERIES} accessibilityLabel="Visitors by month" />;
```

## Bars

```showcase-example
c-chart-2
```

```showcase-example
c-chart-3
```

```showcase-example
c-chart-4
```

```showcase-example
c-chart-5
```

```showcase-example
c-chart-6
```

```showcase-example
c-chart-7
```

```showcase-example
c-chart-8
```

```showcase-example
c-chart-9
```

```showcase-example
c-chart-10
```

```showcase-example
c-chart-11
```

```showcase-example
c-chart-12
```

## Areas and lines

```showcase-example
c-chart-13
```

```showcase-example
c-chart-14
```

```showcase-example
c-chart-15
```

```showcase-example
c-chart-16
```

```showcase-example
c-chart-17
```

```showcase-example
c-chart-18
```

## Pies and donuts

```showcase-example
c-chart-19
```

```showcase-example
c-chart-20
```

```showcase-example
c-chart-21
```

```showcase-example
c-chart-22
```

## Radars

```showcase-example
c-chart-23
```

```showcase-example
c-chart-24
```

## Radial bars

```showcase-example
c-chart-25
```

## API Reference

```showcase-api

```

## Accessibility

- The plot is an image named by its `accessibilityLabel`; pies, radars and radial bars add every value to that name.
- Each category is a button that reads its values; the selected one says so.
- Legend entries that select slices are buttons, with their selected state.
