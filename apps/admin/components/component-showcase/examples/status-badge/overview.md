## When to use

- A record's status shown the same way in every table, card and page, such as Active, Suspended or Pending
- Statuses mapped from a domain enum to a tone in one place, so the colours never drift

## When not to use

- A one-off label or count: use [Badge](/components/badge)

## Notes

- Map each domain status to a `tone` and a label once (a `Record<Status, { tone; label }>`), and render `StatusBadge` from it everywhere
- Tones are semantic: `success`, `warning`, `danger`, `info`, `neutral` and `muted`

## Status Badge: one look per status

`StatusBadge` is a `Badge` driven by a semantic `tone` rather than a variant: the kit maps each tone to its badge colours, so a status always looks the same wherever it appears.

### What is Status Badge?

A thin wrapper: `tone` picks the colours (`success` → green light badge, `danger` → red, and so on), and children are the label.

### Why use Status Badge?

Statuses repeat across tables, detail pages and dashboards. Mapping them to tones once keeps every screen consistent and makes a colour change a one-line edit.

### Status Badge features

- **Six tones.** `success`, `warning`, `danger`, `info`, `neutral` and `muted`.
- **Badge underneath.** Sizes and extras as `Badge` has them.

## Integrating with other components

Render it in [Data Table](/components/data-table) cells and [Card](/components/card) headers from a domain status map. Use [Badge](/components/badge) directly for anything that is not a status.

## Frequently asked questions

### Why not use Badge directly?

You can, but then every screen picks its own colour for "Suspended". `StatusBadge` puts that decision in one map.

### Is it accessible?

It is text, so the status is read as a word; the tone only adds colour.
