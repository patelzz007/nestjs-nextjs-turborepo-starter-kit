## When to use

- A trend over time (areas, lines, bars by month)
- A comparison of a few categories (bars), or of shares of a whole (a pie or donut, up to five slices)
- A profile across a few measures (a radar), or scores against a target (radial bars)

## When not to use

- One number that matters: a stat tile or KPI card says it faster
- Exact values to read and compare row by row: use a Table
- Two measures on different scales: two charts, never two axes

## Notes

- Drawn with react-native-svg in the theme's chart tokens (`chart-1` … `chart-5`); textures (stripes, dots, crosshatch) tell series apart without colour
- A tap selects a category and a readout shows its values (the web's tooltip); every category reads its values to a screen reader
- A legend is shown for two or more series; a single series is named by the card's title

## Chart

The chart family draws data on a phone: `BarChart` (vertical, horizontal, thin, 3D blocks), `AreaChart` (areas and lines; smooth, straight or stepped; stacked; glowing), `PieChart` (pie or donut, a centre, an active slice), `RadarChart` and `RadialBarChart`, with `ChartLegend`.

### Features

- **Fills**: solid, five gradient tones, stripes, dots and a crosshatch.
- **Selection** by a tap, controlled or the chart's own, with a readout of the values.
- **Accessible**: the plot is an image named by `accessibilityLabel`; each category, slice or ring reads its values.
- **Theme colours** read from the stylesheet, in light and dark.

## Integrating with other components

Put a chart in a Card with its title and a trend Badge; pair a donut with a figure in its hole; keep a Table of the same data a tap away for exact values.

## Frequently asked questions

### Why is there no tooltip?

A phone has no hover. Tap a category instead: the chart marks it and shows a readout of its values above the plot.

### How do I keep series apart for colour-blind readers?

Give one series a texture (`fill: { kind: "stripes" }`) and keep the legend; never tell series apart by colour alone.
