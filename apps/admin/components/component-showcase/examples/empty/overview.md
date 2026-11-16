## When to use

- First-run screens and card sections that add the first record, invite a team or connect a data source
- Search with no matches, a not-found page with a search field, or a prompt shown before the first search
- Caught-up notices with nothing left to act on, such as inbox zero or no new notifications

## When not to use

- A screen shown while a fetch is still running: use [Skeleton](/components/skeleton) or [Spinner](/components/spinner)
- A square container for one icon in a list row or a card: use [Icon Tile](/components/icon-tile)

## Notes

- `border` on `Empty` draws a dashed outline; add `border-solid` for a solid line
- `EmptyMedia variant="icon"` puts the icon in a small muted tile; the default media has no fill, for illustrations
- `Empty` grows (`flex-1`) and centres its children, so in a column of set height it fills the free space

## Empty: nothing here yet

`Empty` is the state shown when a list, a page or a search has nothing to show: media, a title, a description and a next step. It turns a blank space into guidance.

### What is Empty?

`EmptyHeader` with `EmptyMedia`, `EmptyTitle` and `EmptyDescription`, then `EmptyContent` for actions — "Add your first merchant", a search field, an upload zone.

### Why use Empty?

An empty table with no explanation looks broken. A good empty state says why it is empty and what to do next, which is often the most important call to action of a new account.

### Empty features

- **Media.** An icon in a tile, an illustration, or stacked previews.
- **Actions.** Buttons, search fields and upload zones in `EmptyContent`.
- **Borders.** A dashed outline for drop zones.

## Integrating with other components

Show it in a [Card](/components/card) or under a [Data Table](/components/data-table) (its `emptyState` uses the same idea), with [Button](/components/button)s for actions and an [Input Group](/components/input-group) for search.

## Frequently asked questions

### What should an empty state say?

What would normally be here, why it is empty (no data yet, or no matches), and the one action that fills it.

### Is it accessible?

It is plain content: the title is a heading-styled element and actions are ordinary buttons and links.
