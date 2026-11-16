## When to use

- A row of headline numbers on a dashboard or a profile
- Figures with a short hint and a glyph for what they are about

## When not to use

- A number with a trend against the last period: use KpiStatCard
- A single count on a control: use CountBadge

## Notes

- Each tile is read as “label: value”, then its hint
- `plain` (default) stands the figures on their surface, so stats in a card are never boxes in a box

## StatTiles

`StatTiles` lays out headline numbers that wrap onto more rows on a narrow screen; each tile can add a hint and a glyph in a tinted tile.

### Features

- **Variants** `plain`, `muted`, `outline`.
- **Sizes** `md` and `sm`.
- **Hint and glyph** per tile.

## Integrating with other components

Put plain tiles inside a Card, or outline tiles on a tinted surface.

## Frequently asked questions

### StatTiles or KpiStatCard?

KpiStatCard when the change against the last period matters; StatTiles for the figures alone.
