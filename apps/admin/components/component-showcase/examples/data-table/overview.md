## When to use

- Lists of records people search, filter, sort, page and act on: orders, merchants, members, invoices
- Admin screens with row actions, bulk actions, export, and columns people hide, pin, resize or move
- Lists backed by an API, a page at a time or as an endless feed
- Records that hold records (a tree), or rows that open to show more (a detail row or a sub-table)

## When not to use

- A short static list with nothing to search or sort: use [Table](/components/table)
- A grid of cells people select in blocks, copy, paste and fill, like a spreadsheet: use [Spreadsheet](/components/spreadsheet)

## Notes

- Every table needs three props: `data`, `columns` and `getRowId`. Each other prop switches one job on, and the job is off while its prop is absent
- Keep `columns`, `filters`, `rowActions` and the other option objects stable (module constants or `useMemo`): a new object on every render redraws the table
- The page owns everything about the domain (columns, filters, actions, wording) and the table only draws it
- Rows are always named by their id, never by their position, so a tick or an edit follows its row through a sort, a filter or a page

## Data Table: the kit's one table for records

`DataTable` is the only table a page imports for a list of records. It is built on TanStack Table and covers the toolbar (search and filters), sorting, paging, row actions, bulk selection, export, column controls, inline editing, drag to reorder, tree rows, detail rows, pinned rows, footer totals, virtualised rows and columns, mobile cards, and loading, empty and error states. It reads client data, one server page at a time, or an endless feed.

### What is Data Table?

One component for the list screens of an admin app. You pass the rows, the column definitions and one prop per job you want done. It draws the table, the toolbar, the pager and the states, with every string taken from the kit's language pack.

### Why use Data Table?

Every list screen needs the same jobs done, and building them per screen drifts in behaviour and look. `DataTable` gives each screen the same keyboard support, the same accessibility and the same wording, and remembers each reader's column choices.

### Data Table features

- **Search and filters.** `search` over named columns; `filters` of kind `select` or `multi-select`, each option with its row count, and `date-range` for a span of days.
- **Sorting and paging.** `sorting` sets the starting sort and the click cycle; `paging` sets the page sizes.
- **Three sources.** `source` is `client` (default), `server` (one `query` object the page owns) or `infinite`.
- **Row and bulk actions.** `rowActions` for the menu on each row; `selection` for checkboxes, bulk actions and delete.
- **Export.** `exporting` writes CSV, JSON, PDF or a spreadsheet of the ticked rows or every matching row.
- **Columns.** `columnControls` lets readers hide, pin, resize and move columns.
- **Editing and reordering.** `editing` for in-place cell edits; `rowReorder` for a drag grip on every row.
- **Row structure.** `tree`, `detail`, `rowPinning` and `rowStatus`.
- **Look.** `layout` for density, stripes, borders, sticky header and height; `virtualize` for long or wide tables; `mobileCard` for a table narrower than 640px (a phone, or a narrow panel).
- **Remembering.** `preferences` saves each reader's choices under a key.

## Integrating with other components

Status cells use [Badge](/components/badge)s, the row menu is a [Dropdown Menu](/components/dropdown-menu), a destructive bulk action confirms with an [Alert Dialog](/components/alert-dialog), and a query builder such as [Filters](/components/filters) sits in the toolbar through `toolbar.extra`. The dashboard home page shows the Kitchen Sink example above.

## Frequently asked questions

### Data Table or Spreadsheet?

`DataTable` for a list of records with a toolbar, a pager and actions. [Spreadsheet](/components/spreadsheet) for a grid of cells with range selection, copy and paste, and drag to fill.

### How do I connect it to an API?

Pass `source={{ mode: "server", totalCount, query, onQueryChange }}`. The page owns the one `query` object (page, page size, sort, filters, search), usually in the URL, and fetches again when the table reports a change.

### Does it remember people's column choices?

Yes: pass `preferences={{ key }}`, and the hidden, pinned, moved and resized columns, the sort and the page size survive a reload. Pass `storage` to keep them somewhere other than the browser.

### How do I make a column editable?

Declare `meta: { cellEdit: {} }` on the column and pass `editing={{ onCellEdit }}`. Give `cellEdit` a `parse` function to turn typed text into the column's value, or to refuse it, and a `validate` function to show a message under the editor until the value is fixed.

### How do I save an edit to the server?

Return the save's promise from `onCellEdit`. The cell is marked while it saves. If the promise rejects, `onCellEdit` is called again with `source: "revert"` and the old value, the cell is marked as failed, and the failure is announced. Add `history: true` for Undo and Redo: they come back through `onCellEdit` with `source: "undo"` or `"redo"`.

### Is it accessible?

It draws a real table. Sortable headers announce their sort, checkboxes and menus are labelled, a clickable row is reachable with the keyboard, and selection and paging are announced as they change.
