---
title: "ADR 097: One Data Table"
tags: ["adr", "ui", "data-table", "spreadsheet", "tanstack-table"]
description: "The web kit has one table for records (DataTable) and one grid for cells (Spreadsheet). Both are thin public components over one private engine that apps cannot import. Every table needs data, columns and getRowId; each other prop switches one job on. Server tables are driven by one query object."
author: "Platform Team"
category: "Architecture decisions"
date: 1795046400000
lastUpdated: 1795046400000
editedAt: 1795046400000
coverImage: "/images/covers/adr/097-one-data-table.webp"
order: 97
---

# ADR 097: One Data Table

## Status

Accepted (2026-11-19). Built for the web kit (`packages/ui`) and every web page that shows a table. The native kit
(`packages/ui-native`) follows the same shape next; until then it keeps its two components and reads the old names
through a temporary alias file (`packages/ui-kit-logic/src/data-grid/index.ts`).

The plan this decision came from is [the data table unification plan](../architecture/data-table-unification-plan.md).
The plan calls this record "ADR 095"; numbers 095 and 096 were taken by the time it was written.

## Context

The kit had two table components that grew apart:

| | `DataTable` (old) | `DataGrid` |
|---|---|---|
| Used by | 18 real pages | No real page, only 34 showcase examples |
| Shape | One component, about 60 flat props | 20 parts a page assembled itself |
| Had and the other lacked | Toolbar, search, filters, bulk bar, export, mobile cards, saved preferences | Column resizing and reordering, tree rows, detail rows, row pinning, cell selection, clipboard, virtualised columns, infinite loading |

A page had to pick one and lose the other's features. Fixes landed in one and not the other. The grid's parts were
public, so nothing stopped a page from assembling its own table and drifting from every other page.

## Decision

**One public component per job, over one private engine.**

| Layer | Path | Who may import it |
|---|---|---|
| `DataTable` — a list of records | `packages/ui/src/components/data-table.tsx` | Apps |
| `Spreadsheet` — a grid of cells | `packages/ui/src/components/spreadsheet.tsx` | Apps |
| Their private parts | `packages/ui/src/internal/data-table/`, `internal/spreadsheet/` | Only `packages/ui` |
| The table engine (was `DataGrid`) | `packages/ui/src/internal/table-engine/` | Only `packages/ui` |
| Pure logic shared with the native kit | `packages/ui-kit-logic/src/table/`, `src/spreadsheet/` | Both kits |

### The engine is private

| Guard | Where |
|---|---|
| The package's `exports` map has no `./internal/*` entry, so the import cannot resolve | `packages/ui/package.json` |
| A lint rule refuses `@workspace/ui/internal/...` in apps and other packages | `packages/oxlint-config/import-boundaries.js` |
| A contract test scans every app and package for that import and checks the `exports` map | `packages/ui/src/__tests__/ui-kit-contract.test.ts` |

Inside `packages/ui` the private folders are imported by relative path. The package's own name resolves through the
same `exports` map, so `@workspace/ui/internal/...` cannot be used there either. That is the guard working.

### `DataTable`: three required props, then one prop per job

```tsx
<DataTable data={invoices} columns={COLUMNS} getRowId={getInvoiceId} search={SEARCH} filters={FILTERS} paging={PAGING} />
```

| Rule | Why |
|---|---|
| `data`, `columns` and `getRowId` are required. | Rows are named by id everywhere (selection, editing, reordering, expansion), never by position, so a tick or an edit follows its row through a sort or a page. |
| Every other prop switches one job on, and takes one options object. | A reader of a page sees which jobs are on. The old table had about 60 flat props whose combinations nobody could list. |
| A job is off while its prop is absent. | No hidden defaults: a client table pages only when `paging` is set. |
| The page owns the domain. | Columns, filters, actions and wording come from the page. The table draws them and reports what the reader did. It never changes the rows itself. |

The props, by job: `source`, `heading`, `toolbar`, `footer`, `status`, `emptyState`, `search`, `filters`, `sorting`,
`paging`, `onRowClick`, `rowActions`, `selection`, `exporting`, `tree`, `detail`, `rowReorder`, `rowPinning`,
`rowStatus`, `columnControls`, `editing`, `layout`, `virtualize`, `mobileCard`, `preferences`, `labels`.

### A server table is driven by one query object

```tsx
<DataTable data={page.rows} columns={COLUMNS} getRowId={getId} source={{ mode: "server", totalCount, query, onQueryChange }} />
```

`query` holds the page, the page size, the sort, the filters and the search. The page owns it (usually in the URL)
and fetches again when `onQueryChange(next, change)` fires. `change.kind` says what moved (`page`, `page-size`,
`sorting`, `search`, `filter`, `clear-filters`), so the page can write only that part of its state. The old table
needed five props and four callbacks for the same thing.

`source` is `client` by default (the table sorts, filters and pages the rows it holds) or `infinite` (the table asks
for more as the reader nears the end).

### `Spreadsheet` is for cells

`Spreadsheet` adds range selection, the clipboard, a fill handle and an in-place editor on the same engine. Every
write (a paste, a cut, a clear, a fill, an edit) arrives as one batch in `onCellsChange`; the page applies it.
`DataTable`'s own `editing` prop reuses the same editor for single cells and loads it only when the prop is set.

### Labels

The engine's wording is its own label family, `tableEngine`, shared by both components. `DataTable`'s `labels` prop
takes overrides for `dataTable` and `tableEngine` keys in one flat object; no key exists in both families.

## What was dropped

| Dropped | Instead |
|---|---|
| The public `data-grid/*` parts | `DataTable` or `Spreadsheet`. No page assembles a table from parts. |
| `Action.iconBgColor` and `Action.className` | `tone: "destructive"` for the one case that needs to look different. |
| `pagination`, `sorting`, `onManualSortingChange`, `manualColumnFilters`, `onManualColumnFilterChange` | `source` with one `query`. |
| `searchKeys`, `pageSize`, `pageSizeOptions`, `persistKey`, `isLoading`, `isRefetching`, `error`, `toolbarContent`, `checkbox` | `search`, `paging`, `preferences`, `status`, `toolbar.extra`, `selection` + `exporting`. |
| Rows tracked by position | `getRowId` is required. |
| Saved preferences under `datatable:` | The key prefix is `datatable:v2:`; older saved choices are not read. Nothing is deployed, so nothing is migrated. |

## Consequences

| Good | Cost |
|---|---|
| Every list page has the same features, keys, wording and accessibility. | Every page that used the old table was rewritten onto the new props (18 pages, in one change). |
| A fix to the engine reaches every table and every spreadsheet. | A feature a page needs and the table lacks is added to the table, not built on the page. |
| The public surface is two components and their types. | The engine cannot be used directly even when that would be quicker. That is the point. |
| Web and native share the pure logic (query, preferences, export text, labels). | The native kit still has two components until it is rebuilt the same way. |

## Rules that follow

- A page that lists records uses `DataTable`. A page that edits cells in blocks uses `Spreadsheet`.
- Nothing outside `packages/ui` imports from `internal/`.
- A new table feature is a new prop on `DataTable` (one options object, off when absent), with a test and a showcase
  example. It is not a new component and not a page-level wrapper around engine parts.
- Columns, filters, actions and option objects are module constants or memoised: a new object on every render
  redraws the table.
