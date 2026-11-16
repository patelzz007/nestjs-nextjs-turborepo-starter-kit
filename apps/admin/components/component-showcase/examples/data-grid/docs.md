## Installation

The data grid ships with the kit in `packages/ui/src/components/data-grid/`, built on TanStack Table v9 and TanStack Virtual, already installed. Its strings come from the `dataGrid` labels.

```showcase-example
c-data-grid-1
```

## TanStack Table v9

TanStack Table v9 asks every table to declare the features it uses, so the grid exports a ready-made bundle:

```tsx
import { useTable, type ColumnDef } from "@tanstack/react-table";

import { DataGrid, dataGridFeatures, type DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
```

```tsx
const COLUMNS: ColumnDef<DataGridFeatures, Merchant>[] = [
	{ accessorKey: "name", header: "Name" },
	{ accessorKey: "status", header: "Status" },
];

const table = useTable({
	features: dataGridFeatures,
	columns: COLUMNS,
	data: merchants,
	state: { sorting, pagination },
	onSortingChange: setSorting,
	onPaginationChange: setPagination,
	getRowId: (row) => row.id,
});

<DataGrid table={table} recordCount={merchants.length}>
	<DataGridTable />
	<DataGridPagination />
</DataGrid>;
```

You still own the table. `DataGrid` accepts any feature bundle — extend `dataGridFeatures` with more TanStack features, or pass a leaner one. Keep `cellSelectionFeature` when you want the spreadsheet layer; without it, `tableLayout.cellSelection` has nothing to drive.

## Examples

### Row selection

```showcase-example
c-data-grid-7
```

### Expandable rows

```showcase-example
c-data-grid-8
```

### Column resizing and pinning

```showcase-example
c-data-grid-15
```

```showcase-example
c-data-grid-16
```

### Draggable rows

```showcase-example
c-data-grid-14
```

### Totals footer

```showcase-example
c-data-grid-24
```

### Remote infinite scroll

```showcase-example
c-data-grid-28
```

### Spreadsheet editing

```showcase-example
c-data-grid-31
```

### Server-side pagination

```showcase-example
c-data-grid-34
```

## API Reference

```showcase-api

```

## Keyboard

| Key                         | Action                                      |
| :-------------------------- | :------------------------------------------ |
| `Enter` `Space` on a header | Changes the column's sort.                  |
| `↑` `↓` `←` `→`             | Moves the active cell, in spreadsheet mode. |
| `Shift` + arrows            | Extends the cell selection.                 |
| `⌘ C` / `⌘ V`               | Copies and pastes the selection.            |
| `Enter` / `Esc`             | Starts or commits an edit / cancels it.     |

## Accessibility

- A real table: sortable headers expose `aria-sort`; selection checkboxes and column menus are labelled from the `dataGrid` messages.
- In spreadsheet mode (cell selection), the grid exposes `aria-rowcount` and `aria-rowindex`, so the full size and each row's position are announced.
