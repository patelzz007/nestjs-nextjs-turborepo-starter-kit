## When to use

- Dashboard headlines that show a trend against the previous period
- A metric that is loading, with its place held

## When not to use

- Figures without a comparison: use StatTiles

## Notes

- The caller says whether a move is good news (`sentiment`): the card never assumes up is good
- The direction is a glyph and words, never colour alone

## KpiStatCard

`KpiStatCard` shows one headline number with its change against the previous period, or that there was nothing to compare with.

### Features

- **Change** `change` (direction, sentiment, label) or `noPrevious`.
- **Glyph** in a tinted tile (`icon`, `iconTone`).
- **Loading**: bones, announced busy.
- **Direction words** in any language.

## Integrating with other components

Lay several out in a column or a two-column grid on a dashboard screen.

## Frequently asked questions

### How is the change read out?

“Revenue: RM 48,210, up +12.4% vs the previous 30 days”: the direction in words, then the comparison.
