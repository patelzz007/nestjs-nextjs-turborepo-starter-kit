## When to use

- Short lists of records such as invoices, orders, members, files or API keys, one per row
- Rows with status badges, avatars, a totals footer or a menu of row actions
- Label-and-value pairs describing one record, such as an employee profile or a server's settings

## When not to use

- Rows people sort, filter, page or select: use [Data Table](/components/data-table) or [Data Grid](/components/data-grid)
- A list of rich rows with an avatar, text and an action: use [Item](/components/item)

## Notes

- `Table` wraps itself in a horizontally scrolling container; `className` lands on the inner `table`
- Cells do not wrap by default: a long value widens the table and it scrolls sideways — add `whitespace-normal` to cells that should wrap

## Table: the semantic HTML table, styled

`Table` and its parts — `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption` — are the native table elements with the kit's typography and borders. Nothing more: the data and the behaviour are yours.

### What is Table?

The plain table for small datasets that need no sorting or paging: an order's lines, a list of API keys, a comparison.

### Why use Table?

Real table markup gives screen readers row and column navigation for free, and a consistent style keeps every list in the app the same.

### Table features

- **Native elements.** `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `caption`.
- **Horizontal scrolling.** Built into the wrapper.
- **Footers and captions.** Totals and descriptions.

## Integrating with other components

Put [Badge](/components/badge)s and [Avatar](/components/avatar)s in cells, a [Dropdown Menu](/components/dropdown-menu) in an actions column, and the table in a [Card](/components/card). When rows need sorting or filtering, switch to [Data Table](/components/data-table).

## Frequently asked questions

### Table or Data Table?

`Table` for a short, static list; [Data Table](/components/data-table) as soon as people need to search, sort, filter, page or select.

### Is it accessible?

Yes: it is a real table. Use `TableHead` for header cells and add a `TableCaption` (visible or not) to describe it.
