## When to use

- A row of headline numbers on a dashboard, each with a label, a value, a hint and an icon
- Compact summaries above a table or a chart, such as active merchants or open disputes

## When not to use

- A number compared with the previous period, with an up or down change: use [KPI Stat Card](/components/kpi-stat-card)
- A chart of the number over time: use a [Card](/components/card) with a [Chart](/components/chart)

## Notes

- Format the value yourself (`"1,284"`, `"RM 48,210"`): the card prints it as given
- `tone` colours the icon's tile

## Stat Card: a headline number

`StatCard` shows one metric: a label, a large value, a short hint and an icon in a tinted tile. It is the simplest tile of a dashboard row.

### What is Stat Card?

A compact card for "how many": active merchants, rewards claimed, open disputes. The hint adds context ("+42 this week", "2 need a reply today").

### Why use Stat Card?

Dashboards open with a row of numbers. A shared stat card keeps them the same size, weight and spacing, whatever they count.

### Stat Card features

- **Label, value, hint and icon.**
- **Tones.** The icon tile's colour.

## Integrating with other components

Lay several in a responsive grid above a [Data Table](/components/data-table) or a [Chart](/components/chart); use [KPI Stat Card](/components/kpi-stat-card) where the change since last period matters.

## Frequently asked questions

### Stat Card or KPI Stat Card?

A stat card for a count with a hint; a KPI stat card for a value compared with the previous period, with a trend and a loading state.

### Is it accessible?

The label and value are text, read in order; the icon is decorative.
