## When to use

- Dashboard headlines that compare a value with the previous period, with an up, down or flat change
- KPI rows that load with the rest of the page and show a skeleton until their numbers arrive

## When not to use

- A count with a hint and no comparison: use [Stat Card](/components/stat-card)
- The metric's history over time: use a [Chart](/components/chart)

## Notes

- `change` describes the comparison: a direction, a sentiment (good or bad) and a label, or `noPrevious` when there is nothing to compare
- Sentiment is separate from direction: a rise in refunds is up but bad
- `isLoading` swaps the value for a skeleton

## KPI Stat Card: a metric and its trend

`KpiStatCard` shows a key metric with its change against the previous period: the value, a coloured change badge (up, down or flat, good or bad) and the comparison label ("vs last 30 days").

### What is KPI Stat Card?

The tile behind a reporting dashboard: revenue, active users, referrals — each with how it moved.

### Why use KPI Stat Card?

A number means more beside its trend. Separating direction from sentiment keeps the colour honest (fewer complaints is down and good), and the loading state keeps the row stable while data loads.

### KPI Stat Card features

- **Change badge.** Direction and sentiment, with a label.
- **No previous period.** A neutral note instead of a misleading change.
- **Loading.** A skeleton in place of the value.
- **Icons and tones.**

## Integrating with other components

Lay a row above a [Chart](/components/chart) of the same metric; the app's analytics dashboard computes changes with the shared reporting helpers and passes them in.

## Frequently asked questions

### How do I show "no data last period"?

Pass `change={{ status: "noPrevious", label: "New this period" }}`.

### Is it accessible?

The change is text, not only colour; the direction words come from the `kpiStatCard` labels.
