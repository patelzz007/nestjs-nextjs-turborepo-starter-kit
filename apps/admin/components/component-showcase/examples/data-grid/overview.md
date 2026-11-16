## When to use

- Admin and back-office tables that sort, filter, paginate and select rows, composed part by part
- Spreadsheet-style editing with cell selection, the clipboard, fill and inline edits
- Large record sets that need virtualised rows or columns, infinite scroll, pinned rows or tree rows

## When not to use

- A short static list with no sorting or paging: use [Table](/components/table)
- A records screen that wants every feature from one component and a few props: use [Data Table](/components/data-table)
- Records moved as cards between status columns: use [Kanban](/components/kanban)

## Notes

- With `manualPagination`, pass the server total to `useTable` as `rowCount` as well as `recordCount`, or the page buttons never render
- Give `useTable` a stable `getRowId` whenever rows can be pinned, reordered or virtualised
- Swap `DataGridTable` for `DataGridTableVirtual` when rows need virtualisation or infinite scroll

## Data Grid: a composable grid on TanStack Table v9

`DataGrid` is a set of parts for building grids on TanStack Table v9: you own the `useTable` instance, and the grid renders it — headers with sort, filter and column menus, bodies (plain, virtualised, drag-and-drop), pagination, footers, and a spreadsheet layer with cell selection, clipboard and fill.

### What is Data Grid?

A context (`DataGrid`), table renderers (`DataGridTable`, `DataGridTableVirtual`, `DataGridTableDndRows`…), column parts (`DataGridColumnHeader`, `DataGridColumnFilter`, `DataGridColumnVisibility`), `DataGridPagination` and `DataGridScrollArea`. `dataGridFeatures` is the ready-made feature bundle TanStack Table v9 asks for.

### Why use Data Grid?

When a grid needs control that a single prop-driven table cannot give — your own feature bundle, custom row models, spreadsheet editing, virtual columns — the grid's parts let you compose exactly that, with the kit's styling and accessibility.

### Data Grid features

- **Sorting, filtering, pagination and selection.**
- **Columns.** Resize, move, drag, pin, hide, with icons and controls in the header.
- **Rows.** Expandable, sub-tables, drag to reorder, pinned, tree rows.
- **Spreadsheet layer.** Cell selection, clipboard, fill handle and inline editing.
- **Scale.** Row and column virtualisation; local and remote infinite scroll.
- **Layout.** Cell borders, dense, striped, borderless, sticky header, footers with totals.

## Integrating with other components

Toolbar filters come from [Filters](/components/filters), row actions from [Dropdown Menu](/components/dropdown-menu), statuses from [Badge](/components/badge), and the whole grid sits in a [Card](/components/card) or a [Frame](/components/frame). For the common records screen, [Data Table](/components/data-table) wraps much of this behind props.

## Frequently asked questions

### Data Grid or Data Table?

[Data Table](/components/data-table) for a records screen in a few props; Data Grid when you need to own the table instance — custom features, spreadsheet editing, virtual columns.

### How do I type columns?

`ColumnDef<DataGridFeatures, Row>` — the leading feature generic is TanStack Table v9's. With your own bundle, use `typeof features`.

### How do I page on the server?

`manualPagination: true` with `rowCount` on `useTable`, and pass `recordCount` to `DataGrid`, as the Server-Side Pagination example does.

### Is it accessible?

It renders a real table with sortable headers (`aria-sort`), labelled selection checkboxes, and keyboard-operable menus; the spreadsheet layer adds arrow-key cell navigation.
