## Installation

`DataTable` ships with the kit in `packages/ui/src/components/data-table.tsx`, built on TanStack Table; there is nothing to install. Its strings come from the `dataTable` and `tableEngine` labels.

```showcase-example
c-data-table-1
```

## Usage

```tsx
import { DataTable, type DataTableColumns, type DataTableFilter } from "@workspace/ui/components/data-table";
```

```tsx
// Module constants: a new array on every render would redraw the table.
const COLUMNS: DataTableColumns<Invoice> = [
	{ accessorKey: "number", header: "Invoice" },
	{ accessorKey: "merchant", header: "Merchant" },
	{ accessorKey: "amount", header: "Amount" },
];
const FILTERS: readonly DataTableFilter[] = [{ kind: "select", column: "status", label: "Status", options: STATUS_OPTIONS }];
const SEARCH = { columns: ["number", "merchant"] };
const PAGING = { pageSize: 10 };

function getInvoiceId(invoice: Invoice): string {
	return invoice.id;
}

<DataTable data={invoices} columns={COLUMNS} getRowId={getInvoiceId} filters={FILTERS} search={SEARCH} paging={PAGING} />;
```

`data`, `columns` and `getRowId` are required. Every other prop switches one job on. A string `header` becomes a sortable column header with that title.

## Finding rows

### Search and filters

```showcase-example
c-data-table-2
```

### Date-range filter

```showcase-example
c-data-table-30
```

### Pagination and sorting

```showcase-example
c-data-table-12
```

## Acting on rows

### Row actions

```showcase-example
c-data-table-3
```

Each entry in the ⋯ menu has an icon tile, a title (`label`) and a subtitle (`description`), and both are required. The icon tile is coloured. Set `tone` to pick a colour (`blue`, `violet`, `teal`, `green`, `orange`, `yellow`), or `destructive` for an action that removes something. If an entry has no tone, it takes the next colour in menu order, so neighbouring entries never share one.

An action can be offered on some rows only. Give it `isAvailable: (row) => boolean`: rows it returns `false` for leave the action out of the ⋯ menu, the inline buttons and the mobile card. For example, `isAvailable: (job) => job.state === "failed"` shows Retry on failed jobs only. The actions column keeps the width every action needs, so it does not jump from row to row.

### Bulk selection

```showcase-example
c-data-table-4
```

### Export

```showcase-example
c-data-table-5
```

Search and export both take `keys`: the row's own field names, typed from the row, so a misspelled key fails typecheck. A key doesn't have to be a column. An email shown under a name, or a currency next to an amount, is searched and exported the same way. `search.keys` lists the fields the search box matches. `exporting.keys` lists the fields written, in that order; leave it out to export every column. In the dialog, the keys are listed first and start ticked.

### Inline editing

```showcase-example
c-data-table-6
```

### Drag to reorder

```showcase-example
c-data-table-7
```

### CRUD with row status

```showcase-example
c-data-table-26
```

## Columns

### Visibility and pinning

```showcase-example
c-data-table-8
```

### Resizing

```showcase-example
c-data-table-9
```

The table always fills its container. If the columns are narrower than the table, the spare width is shared across the unpinned data columns in proportion to their widths, so they spread out evenly, keep their relative widths, and leave no empty strip. Pinned and utility columns keep their own width. To give all the spare width to one column, set `meta: { fillWidth: true }` on it.

A short, soft divider marks each column's edge in the header, with no lines through the rows. Hovering or focusing an edge turns it into a full-height line in the primary colour. While you drag, a guide line runs down the whole table and the column changes width as you move. The edge follows the pointer exactly, and the columns after it take up the difference, so the table keeps its width. On release every column keeps the width it was drawn at, so nothing jumps.

### Reordering

```showcase-example
c-data-table-10
```

### Header controls

```showcase-example
c-data-table-11
```

## Row structure

### Tree rows

```showcase-example
c-data-table-21
```

### Detail row

```showcase-example
c-data-table-22
```

### Detail panel

`detail={{ mode: "panel", render, title }}` opens a row's details beside the table on a row click. ↑ and ↓ step through the rows, Escape closes, and `hideColumnsWhileOpen` makes room. Under 640px of table width the panel is a sheet.

```showcase-example
c-data-table-33
```

### Sub-table

```showcase-example
c-data-table-23
```

### Row pinning

```showcase-example
c-data-table-24
```

### Footer totals

```showcase-example
c-data-table-25
```

### Grouping

`grouping={{ by: ["type"] }}` groups the rows by a column's value. A column with `aggregationFn` (`"sum"`, `"count"`, `"mean"`, `"min"`, `"max"`) shows a subtotal on each group's row, drawn by its `aggregatedCell`. Client and infinite tables only.

```showcase-example
c-data-table-32
```

### Pivot

A pivot is a transform of your data, so there is no pivot prop. `pivotDataTableRows(rows, { rowKey, columnKey, value, aggregation })` returns the grid (keys, cells, row totals, column totals, grand total); turn it into `data`, `columns` and a `footer`. Totals are worked out from the source rows, so an average total is a true average, not an average of averages.

```showcase-example
c-data-table-31
```

## Where the rows come from

### Server source

```showcase-example
c-data-table-18
```

### Infinite source, local

```showcase-example
c-data-table-19
```

### Infinite source, remote

```showcase-example
c-data-table-20
```

## Look and scale

### Layout

```showcase-example
c-data-table-13
```

### Mobile cards

```showcase-example
c-data-table-14
```

### Loading, empty and error

```showcase-example
c-data-table-15
```

### Virtualised rows

```showcase-example
c-data-table-16
```

### Virtualised columns

```showcase-example
c-data-table-17
```

## Printing

Print the page (Ctrl or Cmd + P) and every table on it switches to a print view by itself; there is no prop.

- A client table prints every row it holds, not only the current page. A server table prints the page it has, and a virtualised table prints the rows in view: for everything else, use the export menu.
- The toolbar, the pager, the selection bar and the columns the table adds itself (checkboxes, grips, toggles, pins, row menus) are left out.
- The height limit is dropped, nothing scrolls, and the lines between cells are always drawn.
- A phone prints the table, not the cards.

## Wording and memory

### Localised labels

```showcase-example
c-data-table-27
```

### Saved preferences

```showcase-example
c-data-table-28
```

## Everything together

```showcase-example
c-data-table-29
```

## Recipes

Recipes are whole screens built only from the public props: the table draws the cells, and every rule (colours, validation, timers, parsing) lives in the recipe. Each is one file in this folder (`data-table-recipe-*.tsx`), with its pure helpers exported and tested. The component page splits its examples into groups, one route each, so a page never runs every live table at once; the recipes are the last two groups.

| Group     | Recipes                                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Analytics | Heatmap, Cohort Retention, Conditional Formatting, Production Dashboard, KPIs With Sparklines, Anomaly Investigation, Comparison, Live Status, Deployments, Log Viewer            |
| Workflows | People Directory, Job Queue, Tree Variants, File Browser, Inventory Allocation, Permissions Matrix, Change Review, CSV Import, Schedule Matrix (on `Spreadsheet`), Animated Icons |

The job queue is why `rowActions[].isAvailable` exists: Retry is offered on failed jobs only.

```showcase-example
c-data-table-recipe-job-queue
```

## API Reference

```showcase-api

```

## Props at a glance

| Prop             | Type                                                                | What it does                                                 |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `data`           | `readonly Row[]`                                                    | The rows. In server mode, the current page only.             |
| `columns`        | `DataTableColumns<Row>`                                             | TanStack column definitions.                                 |
| `getRowId`       | `(row) => string`                                                   | A row's stable id.                                           |
| `source`         | `client` \| `server` \| `infinite`                                  | Where the rows come from.                                    |
| `heading`        | `{ title, description, actions }`                                   | The header above the table.                                  |
| `toolbar`        | `{ layout, extra }`                                                 | The toolbar's layout and your own controls in it.            |
| `footer`         | `{ rows }`                                                          | Totals and summary rows under the body.                      |
| `status`         | `{ loading, error, onRetry, skeletonRows }`                         | Loading and error state.                                     |
| `emptyState`     | `{ icon, title, description, action }`                              | What to show with no rows at all.                            |
| `search`         | `{ keys, debounceMs }`                                              | A search box over the named row fields.                      |
| `filters`        | `DataTableFilter[]`                                                 | `select`, `multi-select` and `date-range` filters.           |
| `sorting`        | `{ cycle, initial }`                                                | The click cycle and the starting sort.                       |
| `paging`         | `{ pageSize, pageSizeOptions }`                                     | Pages the rows and shows the pager.                          |
| `onRowClick`     | `(row) => void`                                                     | A row click, or Enter or Space on a focused row.             |
| `rowActions`     | `DataTableRowAction<Row>[]`                                         | The menu at the end of each row.                             |
| `selection`      | `{ bulkActions, onDelete, scope, onScopeChange }`                   | Checkboxes and bulk actions.                                 |
| `exporting`      | `{ formats, filename, keys, mode }`                                 | The export menu, or with `mode: "dialog"` an export dialog.  |
| `tree`           | `{ getSubRows, defaultExpanded, indent }`                           | Rows with child rows.                                        |
| `detail`         | `{ render }`                                                        | Extra content under a row.                                   |
| `rowReorder`     | `{ onReorder }`                                                     | Drag rows to reorder them.                                   |
| `rowPinning`     | `boolean`                                                           | A pin button on every row.                                   |
| `rowStatus`      | `(row) => "new" \| "dirty" \| "deleted" \| undefined`               | A lifecycle mark per row.                                    |
| `columnControls` | `{ visibility, pinning, resizing, reordering, density }`            | What readers may change about the columns.                   |
| `editing`        | `{ onCellEdit, trigger, history }`                                  | In-place cell editing, saving with a revert, and undo.       |
| `layout`         | `{ density, striped, cellBorders, stickyHeader, width, maxHeight }` | The table's look.                                            |
| `virtualize`     | `{ rows, columns, estimateRowHeight }`                              | Draw only what is in view.                                   |
| `mobileCard`     | `(row, rowActions) => ReactNode`                                    | Draws each row as a card when the table is under 640px wide. |
| `preferences`    | `{ key, storage }`                                                  | Saves the reader's choices.                                  |
| `labels`         | `DataTableLabelsOverride`                                           | Overrides some of the table's wording.                       |

## Keyboard

| Key                                           | Action                                                               |
| :-------------------------------------------- | :------------------------------------------------------------------- |
| `Enter` `Space` on a sortable header          | Changes the column's sort.                                           |
| `Enter` `Space` on a clickable row            | Opens the row (`onRowClick`).                                        |
| `Space` on a row checkbox                     | Selects the row.                                                     |
| `Enter` `F2` on an editable cell              | Opens the editor. `Enter` saves, `Esc` cancels.                      |
| `Space`, then the arrow keys, on a row's grip | Picks the row up and moves it. `Space` drops it, `Esc` puts it back. |
| Arrow keys on a header's edge                 | Resizes the column.                                                  |

## Accessibility

- A real table: sortable headers expose `aria-sort`, and checkboxes and menus are labelled from the `dataTable` messages.
- Selection, page changes and row moves are announced through a live region.
- A clickable row is in the tab order and shows a focus ring.
