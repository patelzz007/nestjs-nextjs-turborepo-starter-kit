## When to use

- Lists of records people search, filter, sort, page and act on — orders, merchants, members, invoices
- Admin screens with row actions, bulk actions, CSV export, column visibility and pinning
- Tables that edit in place, reorder by drag, or turn into cards on phones

## When not to use

- A short static list with nothing to search or sort: use [Table](/components/table)
- A spreadsheet-like grid with cell selection, column resizing and keyboard editing: use [Data Grid](/components/data-grid)

## Notes

- Keep `columns`, `filters` and `actions` stable (module constants or `useMemo`): a new array on every render resets the table's state
- The smart layer owns everything domain-specific — columns, filters, actions, copy — and the table only renders it
- For server data, pass `pagination={{ mode: "server", … }}` and own sorting and filtering in the parent

## Data Table: the kit's table for records

`DataTable` is a complete records table on TanStack Table: a toolbar with search and select filters, sortable columns, pagination, row actions, bulk selection with export, column visibility and pinning, inline editing, drag-to-reorder, mobile cards, virtualised rows, loading and error states — each switched on by a prop.

### What is Data Table?

One component for the list screens of an admin app. You pass the rows, the column definitions and the features you want; it renders the table, the toolbar, the pager and the states, with every string from the `dataTable` labels.

### Why use Data Table?

Every list screen needs the same features, and building them per screen drifts in behaviour and look. `DataTable` gives each screen the full set with consistent keyboard support, accessibility and persistence of people's column choices.

### Data Table features

- **Search and filters.** `searchKeys` with a debounce; select `filters`.
- **Sorting and pagination.** A sort cycle and page sizes, client- or server-side.
- **Row and bulk actions.** A ⋯ menu per row; checkbox selection across pages with bulk actions and delete.
- **Export.** CSV, JSON, PDF or spreadsheet of the selection or all rows.
- **Columns.** Visibility and pinning, remembered with `persistKey`.
- **Editing and reordering.** Inline cell edits and drag-to-reorder, mapped back by id.
- **Mobile cards.** `mobileCardRender` below the `lg` breakpoint.
- **Scale and states.** Virtualised rows; loading, refetching, empty and error states.

## Integrating with other components

Status cells use [Badge](/components/badge)s, row actions open [Dropdown Menu](/components/dropdown-menu)s, destructive bulk actions confirm with an [Alert Dialog](/components/alert-dialog), and the whole table sits in a [Card](/components/card) or a page section. The dashboard's document-sections table is the Kitchen Sink example above.

## Frequently asked questions

### Data Table or Data Grid?

`DataTable` for record lists with toolbars and actions; [Data Grid](/components/data-grid) for spreadsheet-like grids with cell selection, resizing and keyboard editing.

### How do I connect it to an API?

Use server mode: `pagination={{ mode: "server", totalCount, pageIndex, pageSize, onPageChange, getRowId }}`, plus `sorting` / `onManualSortingChange` and `manualColumnFilters` / `onManualColumnFilterChange`, and fetch each page with TanStack Query.

### Does it remember people's column choices?

Yes: pass a `persistKey` (and optionally a `storage` adapter) and hidden columns, pinned columns and the page size survive a reload.

### Is it accessible?

It renders a real table with sortable headers announced as such, labelled checkboxes and menus, and live announcements for selection and paging.
