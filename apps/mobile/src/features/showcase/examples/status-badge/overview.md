## When to use

- A record's state that changes over time: online, pending review, failed, archived
- The same status shown the same way across lists, details and headers

## When not to use

- A fixed label that does not change ("Beta", "This device"): use Badge
- A count: use CountBadge

## Notes

- Map your own enum to a tone, a glyph and a label once, in the feature; the badge never sees the raw value
- `accessibilityLabel` names the state; an icon-only badge (`label={null}`) still has one

## StatusBadge

`StatusBadge` is a small capsule with a glyph and an optional label, in a tone that says what the status means.

### Features

- **Tones** `success`, `warning`, `destructive`, `info`, `neutral` and `muted`.
- **Emphasized**: the tone's full-strength border, for a change that just happened.
- **Pulsing**: the pill breathes while a check is pending, and stays still under Reduce Motion.
- **Tabular label**: fixed-width digits for a ticking value.

## Integrating with other components

Put it in a list row's detail, a card header or a table cell.

## Frequently asked questions

### StatusBadge or Badge?

StatusBadge for a state that changes; Badge for a fixed label.

### Which tone for archived?

`muted`: an outline only, quieter than `neutral`.
