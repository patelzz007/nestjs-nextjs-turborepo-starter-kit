## When to use

- A grid of cells people fill in directly: a budget, a price list, a schedule, a bulk import they check before saving
- Data people move to and from Excel or Google Sheets with copy and paste
- Many small edits in one sitting, saved together

## When not to use

- A list of records with a toolbar, filters, a pager and actions: use [Data Table](/components/data-table)
- A short static list: use [Table](/components/table)
- One or two editable fields: use a form

## Notes

- Every spreadsheet needs `data`, `columns` and `getRowId`. A column is writable when it declares `meta.cellEdit`
- The grid never changes the rows itself. A paste, a cut, a clear, a fill or an edit arrives as ONE batch in `onCellsChange`, however many cells it covers, and the page applies it
- Give a column a `parse` function to type what was entered and to refuse what it cannot hold; a refused cell comes back in `rejected`
- Keep `columns` stable (a module constant or `useMemo`): a new array on every render redraws the grid

## Spreadsheet: a grid of cells

`Spreadsheet` is the kit's component for cell work. It shares its table engine with [Data Table](/components/data-table), and adds range selection, the clipboard, a fill handle and an in-place editor.

### What is Spreadsheet?

A grid where the unit is the cell, not the row. Readers move with the arrow keys, select blocks by dragging or with Shift, and edit by typing. The page owns the data and receives every write as a batch.

### Why use Spreadsheet?

People already know how a spreadsheet works. Giving them the same keys and the same clipboard makes bulk entry fast, and the batch callback keeps the page in charge of validation and saving.

### Spreadsheet features

- **Selection.** One cell, a block, or several blocks; `selectionMode="single"` for one cell only.
- **Clipboard.** Copy, cut and paste as tab-separated text, to and from other spreadsheets.
- **Fill handle.** `fillHandle` repeats the selected cells down or across.
- **Editing.** Type, Enter, F2 or double-click; Enter commits and moves down.
- **Typed writes.** `meta.cellEdit.parse` types or refuses each value; `clearValue` is what Delete leaves.
- **Marks.** `cellStatus` and `rowStatus` draw dirty, invalid, new and deleted marks.
- **Draft row.** `draftRow` adds an "add row" button under the last row.
- **Scale.** `virtualize` draws only the rows and columns in view.

## Integrating with other components

Put a Save [Button](/components/button) beside the grid and clear the marks when the save lands. Report a failed save with a [Toast](/components/toast). For a list people filter and page, with a few cells edited in place, use [Data Table](/components/data-table) with its `editing` prop instead.

## Frequently asked questions

### Spreadsheet or Data Table?

`Spreadsheet` when people work on cells: select blocks, paste, fill. [Data Table](/components/data-table) when people work on records: search, filter, page, run actions.

### How do I validate a cell?

Return `undefined` from the column's `parse` to refuse the value. Nothing is written, and the cell is listed in `rejected` with the reason `"invalid"`, so you can mark it with `cellStatus`.

### Can a column be read-only?

Yes: leave `meta.cellEdit` off it. It still copies, and a paste over it is refused with the reason `"readonly"`.

### Is it accessible?

It is an ARIA grid: one focused cell, moved with the arrow keys, with selected cells announced as selected and the editor labelled with its column's title.
