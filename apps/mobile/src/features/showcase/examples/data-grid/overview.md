## When to use

- Records people compare across many columns: members, orders, stock, ledgers
- Grids that need column control (pin, move, resize, hide), expandable or tree rows, footers, or spreadsheet editing
- Long or wide data: rows and columns drawn only as they come into view

## When not to use

- A ready-made list with search, filters and export in one prop set: use DataTable
- A handful of fields per record on a phone: use a list of cards (DataTable's renderCard)

## Notes

- Built on TanStack Table, as on the web: the caller owns the table (`useTable({ features: dataGridFeatures, … })`), its state and its data
- Copy and clipboard text are shared with the web kit (`@workspace/ui-kit-logic` `data-grid`); the grid never writes data, it hands changes to `onCellsChange`
- On a phone the grid scrolls sideways; pinned columns ride the scroll on the UI thread so they stay put

## DataGrid

`DataGrid` publishes a TanStack table to its parts: `DataGridTable` draws it; `DataGridPagination`, `DataGridColumnHeader`, `DataGridColumnVisibility` and the row controls (select, expand, pin, drag handle) sit in column definitions or around the table.

### Features

- **Layouts**: dense, cell borders, borderless, striped, auto width, sticky header.
- **Columns**: sort, pin to either edge, move by menu or grip, resize by handle, show or hide.
- **Rows**: selection, expandable detail and nested grids, trees, pinning, drag to reorder.
- **Footers** whose cells span columns: totals, statistics, aggregates.
- **Scale**: virtualised rows and columns, infinite scroll, server-side paging and sorting.
- **Spreadsheet**: pick a cell or a block, then copy, paste, fill down or right, clear and edit.

## Integrating with other components

Put the grid in a DataGridContainer, a Card or a Frame; build headers with DataGridColumnHeader; copy and paste through expo-clipboard (`onCellsCopy`, `readClipboard`).

## Frequently asked questions

### How is a phone grid different from the web's?

The same table and column definitions drive both. Touch replaces the mouse: a header grip drags a column, a handle drags a width, a long press stretches a cell selection, and a bar replaces keyboard shortcuts. Every gesture has a screen-reader action.

### Why does the grid never change my data?

Data belongs to the caller: the grid reports what to write (`onCellsChange`, `onRowReorder`) and the caller writes it, so validation, undo and saving stay in one place.
