## Installation

`Spreadsheet` ships with the kit in `packages/ui/src/components/spreadsheet.tsx`, built on TanStack Table; there is nothing to install. Its strings come from the `tableEngine` labels.

```showcase-example
c-spreadsheet-1
```

## Usage

```tsx
import { Spreadsheet, type SpreadsheetCellsChange, type SpreadsheetColumns } from "@workspace/ui/components/spreadsheet";
```

```tsx
// A module constant: a new array on every render would redraw the grid.
const COLUMNS: SpreadsheetColumns<BudgetLine> = [
	{ accessorKey: "item", header: "Item", meta: { cellEdit: { control: "text" } } },
	{ accessorKey: "quantity", header: "Quantity", meta: { cellEdit: { control: "text", parse: parseQuantity } } },
];

function getLineId(line: BudgetLine): string {
	return line.id;
}

<Spreadsheet data={lines} columns={COLUMNS} getRowId={getLineId} onCellsChange={handleCellsChange} />;
```

`onCellsChange` receives `{ source, changes, rejected }`. `source` is `"edit"`, `"paste"`, `"cut"`, `"clear"` or `"fill"`. Each change names its cell by `rowId` and `columnId` and carries the new `value` and the `previousValue`.

## Features, one at a time

### Clipboard and fill

```showcase-example
c-spreadsheet-2
```

### Validation and status marks

```showcase-example
c-spreadsheet-3
```

### Draft row

```showcase-example
c-spreadsheet-4
```

### Formulas and A1 headers

`formulas` works out every cell whose text starts with `=`: A1 references (`B2`, `$B$2` stays put when filled), ranges (`A1:C4`), `+ - * / ^`, `&` to join text, comparisons, and `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `IF`, `ROUND`, `ABS`, `CONCAT`, `AND`, `OR`, `NOT`. A formula that cannot be worked out shows `#DIV/0!`, `#REF!`, `#NAME?`, `#VALUE!`, `#CYCLE!` or `#ERROR!`. Your data keeps the formula text. `headers="a1"` titles columns by letter, numbers the rows, and shows the focused cell's address and formula above the grid.

```showcase-example
c-spreadsheet-5
```

## API Reference

```showcase-api

```

## Props at a glance

| Prop                | Type                                                   | What it does                                                                        |
| ------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `data`              | `readonly Row[]`                                       | The rows.                                                                           |
| `columns`           | `SpreadsheetColumns<Row>`                              | TanStack column definitions. A column is writable when it declares `meta.cellEdit`. |
| `getRowId`          | `(row) => string`                                      | A row's stable id.                                                                  |
| `onCellsChange`     | `(change) => void`                                     | Every write, as one batch.                                                          |
| `onCellEditRequest` | `(request) => void`                                    | Asks you to open your own editor for a writable cell with no built-in one.          |
| `selectionMode`     | `"range"` \| `"single"`                                | Blocks of cells, or one focused cell.                                               |
| `onSelectionChange` | `(selection) => void`                                  | The focused cell, the selected regions and the cell count.                          |
| `onCopy`            | `(copy) => void`                                       | Fires after a copy or a cut wrote the clipboard.                                    |
| `fillHandle`        | `{ variant }`                                          | The drag-to-fill handle.                                                            |
| `editing`           | `{ trigger, enterAdvances }`                           | How the editor opens and what Enter does.                                           |
| `rowStatus`         | `(row) => "new" \| "dirty" \| "deleted" \| undefined`  | A mark per row.                                                                     |
| `cellStatus`        | `(row, columnId) => "dirty" \| "invalid" \| undefined` | A corner mark per cell.                                                             |
| `draftRow`          | `{ onCreate, label }`                                  | An "add row" button under the last row.                                             |
| `layout`            | `{ density, cellBorders, stickyHeader, maxHeight }`    | The grid's look.                                                                    |
| `virtualize`        | `{ rows, columns }`                                    | Draw only what is in view.                                                          |
| `labels`            | `Partial<TableEngineLabels>`                           | Overrides some of the grid's wording.                                               |
| `ref`               | `Ref<SpreadsheetApi>`                                  | `focusCell`, `clearSelection`, `scrollToCell`.                                      |

## Keyboard

| Key                     | Action                                                   |
| :---------------------- | :------------------------------------------------------- |
| Arrow keys              | Move the focused cell. With `Shift`, grow the selection. |
| `Tab` `Shift+Tab`       | Move to the next or the previous cell.                   |
| `Enter` `F2`, or typing | Opens the editor. Typing replaces the cell's value.      |
| `Enter` while editing   | Saves and moves down (`Shift+Enter` up). `Esc` cancels.  |
| `Ctrl/Cmd+C` `X` `V`    | Copy, cut and paste the selection.                       |
| `Delete` `Backspace`    | Clears the selected cells.                               |
| `Ctrl/Cmd+A`            | Selects every cell.                                      |

## Accessibility

- An ARIA grid with one focused cell; selected cells are announced as selected.
- The editor is labelled with its column's title.
- A refused write changes nothing on screen, so mark the cell with `cellStatus` to tell the reader.
