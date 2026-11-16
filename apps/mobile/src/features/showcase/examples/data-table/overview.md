## When to use

- A list of records a person searches, filters, sorts and acts on: invoices, users, orders
- Records compared across a few columns, page by page or from a server

## When not to use

- A handful of values read once: use Table, or a DetailList
- Records read one at a time with many fields: render cards (`renderCard`) or a list
- Editing many cells like a spreadsheet: use DataGrid

## Notes

- Built on TanStack Table, like the web kit's; preferences, column ids, selection config and export are shared with it (@workspace/shared)
- Columns are `DataTableColumn`s: an id, a header, the value the table reads, and an optional cell
- Every control is native: menus for filters, columns, export and page size; a ⋯ menu per row; the kit's Checkbox for selection

## DataTable

`DataTable` lays records out as a table that scrolls sideways (or as cards), with search, select filters, sorting, paging, selection, row and bulk actions, export, column visibility and pinning, inline editing, reordering and loading, empty and error states, each switched on by a prop.

### Features

- **Search** over chosen columns, with an optional debounce.
- **Select filters**, each keeping the rows whose value is exactly the choice.
- **Sorting** by a header press, ascending, descending and (optionally) back.
- **Paging** in the table, or by the parent from a server.
- **Selection** across a page or every matching row, with bulk actions and a bulk delete.
- **Export** as CSV, JSON or a spreadsheet, through the share sheet or the app's exporter.
- **Columns menu** to hide and pin columns, remembered through a storage adapter.
- **Inline editing**, **reordering**, **cards**, **virtualised rows** and **loading, empty and error** states.

## Integrating with other components

Draw cells with Badge, Avatar or StatusBadge; draw cards with DataTableCard; confirm actions with a Toast; feed a server-mode table from TanStack Query.

## Frequently asked questions

### How does a server-paged table work?

Pass `pagination={{ mode: "server", totalCount, pageIndex, pageSize, onPageChange, getRowId }}` with the current page as `data`; the table reports page, sort (`onManualSortingChange`) and filter (`onManualColumnFilterChange`) changes, and the parent fetches.

### Where does an export go?

To the system share sheet by default, as the file's text. Pass `exporter` to save it as a file or hand it to another module.
