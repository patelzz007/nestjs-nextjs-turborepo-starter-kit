## When to use

- Rows of records with a few columns: invoices, orders, members, files
- Numbers that are compared down a column
- A vertical table of one record's details (label and value rows)

## When not to use

- Sorting, filtering, selection and paging: use DataTable
- A single list of tappable rows: use ListGroup or Item

## Notes

- Each row is read as one sentence from its `cells`: keep a cell's text even when you draw it with `content`
- A row holding controls is `interactive`, so each control stays reachable
- Wide tables scroll sideways (`scrollable`)

## Table

`Table` lays out rows and columns without borders: a quiet header, banded rows, numbers end-aligned in tabular figures, and an optional footer.

### Features

- **Rich cells** (`content`) with spoken text (`cells`).
- **Column widths** `xs`–`lg`; the first column names the row.
- **Scrollable**, **showCaption**, a **footer** row.
- **Variants** `banded` and `plain`; sizes `md` and `sm`.

## Integrating with other components

Put Avatars, Badges, a DropdownMenu or a NumberField in cells; set it inside a Card or a Frame panel.

## Frequently asked questions

### Why does each row read as one sentence?

So a screen reader hears "INV001: Status Paid, Amount $250.00" instead of loose cells and a header read on its own.
