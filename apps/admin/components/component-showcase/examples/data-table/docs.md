## Installation

`DataTable` ships with the kit in `packages/ui/src/components/data-table.tsx` and its parts beside it, built on TanStack Table; there is nothing to install. Its strings come from the `dataTable` labels.

```showcase-example
c-data-table-1
```

## Usage

```tsx
import { DataTable, type DataTableFeatures, type Filter } from "@workspace/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
```

```tsx
// Module constants: a new array on every render would reset the table's state.
const COLUMNS: ColumnDef<DataTableFeatures, Invoice>[] = [
	{ accessorKey: "id", header: "Invoice" },
	{ accessorKey: "merchant", header: "Merchant" },
	{ accessorKey: "amount", header: "Amount" },
];
const FILTERS: Filter[] = [{ key: "status", label: "Status", options: STATUS_OPTIONS }];

<DataTable data={invoices} columns={COLUMNS} filters={FILTERS} searchKeys={["id", "merchant"]} pageSize={10} title="Invoices" />;
```

Columns are typed against `DataTableFeatures`, so the compiler allows only the APIs the table's features provide.

## Features, one at a time

### Search and filters

```showcase-example
c-data-table-2
```

### Row actions

```showcase-example
c-data-table-3
```

### Bulk selection

```showcase-example
c-data-table-4
```

### Export

```showcase-example
c-data-table-5
```

### Inline editing

```showcase-example
c-data-table-6
```

### Drag to reorder

```showcase-example
c-data-table-7
```

### Column visibility and pinning

```showcase-example
c-data-table-8
```

### Mobile cards

```showcase-example
c-data-table-10
```

### Loading, empty and error

```showcase-example
c-data-table-11
```

### Server mode

```showcase-example
c-data-table-13
```

## API Reference

```showcase-api

```

## Keyboard

| Key                                  | Action                                                   |
| :----------------------------------- | :------------------------------------------------------- |
| `Enter` `Space` on a sortable header | Changes the column's sort.                               |
| `Enter` `Space` on a clickable row   | Opens the row (`onRowClick`).                            |
| `Space` on a row checkbox            | Selects the row.                                         |
| `Enter` / `Esc` while editing a cell | Saves / cancels the edit (double-click a cell to start). |

Drag-to-reorder is pointer-only: give keyboard users "Move up" and "Move down" row actions when order matters.

## Accessibility

- A real table: sortable headers expose `aria-sort`, checkboxes and menus are labelled from the `dataTable` messages.
- Selection, page changes and drag moves are announced through a live region.
