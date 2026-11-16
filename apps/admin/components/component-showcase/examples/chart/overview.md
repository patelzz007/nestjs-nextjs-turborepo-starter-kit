## When to use

- Trend cards that plot monthly or weekly figures as bars, areas or a line
- Part-to-whole breakdowns such as traffic sources, task status or plan tiers, as donut and pie slices
- Score profiles across several axes, such as team skills or audit results, as radar or radial bars

## When not to use

- Headline numbers with a trend badge and no plotted series: use [KPI Stat Card](/components/kpi-stat-card)
- A precise table of values: use [Table](/components/table)

## Notes

- Give every series or slice a `chartConfig` entry with a label and a colour (from the design tokens)
- `ChartContainer` sizes itself to `aspect-video` unless a class overrides it: set an aspect ratio or a height to fit a tile

## Chart: Recharts, themed by the kit

`ChartContainer` wraps Recharts charts with the kit's theming: each series' colour and label come from a `ChartConfig`, exposed as CSS variables that follow light and dark mode. `ChartTooltip`, `ChartTooltipContent`, `ChartLegend` and `ChartLegendContent` give tooltips and legends the kit's look.

### What is Chart?

Not a chart library of its own: you compose Recharts' `BarChart`, `AreaChart`, `LineChart`, `PieChart` or `RadarChart` inside a `ChartContainer`, and the kit supplies the colours, the tooltip and the legend.

### Why use Chart?

Recharts is flexible but unstyled. One config per chart keeps colours tied to design tokens, so every chart in the app matches and switches theme correctly.

### Chart features

- **Every Recharts chart.** Bars, areas, lines, pies, radars and radial bars.
- **Config-driven colours.** `var(--color-<key>)` per series, per theme.
- **Kit tooltips and legends.**
- **Patterns.** Stripes, dots and gradients through SVG defs, as the examples show.

## Integrating with other components

Put charts in a [Card](/components/card) with a title and a [Tabs](/components/tabs) or [Toggle Group](/components/toggle-group) range switcher, beside [KPI Stat Card](/components/kpi-stat-card)s.

## Frequently asked questions

### How do I set a series' colour?

In the `ChartConfig`: `{ revenue: { label: "Revenue", color: "var(--chart-1)" } }`, then use `fill="var(--color-revenue)"` on the series.

### How do I make it fill a card?

Override the container's aspect with a class (`aspect-auto h-64`), and drop any `max-w-*` cap.

### Is it accessible?

Charts are visual: add a title and a summary in text, and pair important charts with the data in a [Table](/components/table). Recharts' `accessibilityLayer` adds keyboard focus to data points.
