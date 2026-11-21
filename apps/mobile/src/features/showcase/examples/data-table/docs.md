## Installation

`DataTable` ships with the kit in `packages/ui-native/src/components/data-table.tsx`; there is nothing to install.

```showcase-example
c-data-table-1
```

## Usage

```tsx
import { DataTable, type DataTableColumn } from "@workspace/ui-native/components/data-table";
```

```tsx
const COLUMNS: readonly DataTableColumn<Invoice>[] = [
	{ id: "merchant", header: "Merchant", value: (row) => row.merchant },
	{ id: "amount", header: "Amount", align: "end", value: (row) => row.amount },
];

<DataTable data={invoices} columns={COLUMNS} searchKeys={["merchant"]} pagination={{ mode: "client", getRowId: (row) => row.id }} />;
```

## Search and filters

```showcase-example
c-data-table-2
```

## Row actions

```showcase-example
c-data-table-3
```

Each entry in the ⋯ menu has an icon tile, a title (`label`) and a subtitle (`description`), and both are required. The icon tile is coloured. Set `tone` to pick a colour (`blue`, `violet`, `teal`, `green`, `orange`, `yellow`), or `destructive` for an action that removes something. If an entry has no tone, it takes the next colour in menu order, so neighbouring entries never share one. The table always spans the screen: when the columns are narrower than the screen, the data columns grow to fill it.

## Selection and bulk actions

```showcase-example
c-data-table-4
```

## Export

```showcase-example
c-data-table-5
```

## Inline editing

```showcase-example
c-data-table-6
```

## Reordering

```showcase-example
c-data-table-7
```

## Columns

```showcase-example
c-data-table-8
```

## Paging and sorting

```showcase-example
c-data-table-9
```

## Cards

```showcase-example
c-data-table-10
```

## States

```showcase-example
c-data-table-11
```

## Long lists

```showcase-example
c-data-table-12
```

## Server mode

```showcase-example
c-data-table-13
```

## Everything at once

```showcase-example
c-data-table-14
```

## API Reference

```showcase-api

```

## Accessibility

- A sortable header is a button that says how the rows are sorted.
- Each row's checkbox is named by the row; selection changes are announced.
- A reorder handle is adjustable, with move actions.
- Refetching marks the table busy; the results line is a live region.
