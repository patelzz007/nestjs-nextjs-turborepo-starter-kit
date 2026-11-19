# Data table unification plan

| | |
|---|---|
| Status | **Plan approved in outline. Implementation has NOT started and must not start until the owner says so** (the owner is waiting for another thread to finish and be pushed). Only documents may be written before then. |
| Written | 2026-11-19 |
| Scope | This repo: `packages/ui` (web kit), `packages/ui-native` (mobile kit), `packages/ui-kit-logic`, `apps/admin`, `apps/docs`, `apps/mobile`. Then the same implementation in two other repos: `nextjs-admin-dashboard-layout` (web) and `expo-boilerplate` (mobile). |
| Outcome | One dumb `DataTable`, one dumb `Spreadsheet` and one private engine on the web, and the same pair on mobile. The old `data-table*` and `data-grid*` files are deleted everywhere. Every pattern of [ShadTable](https://github.com/coros-hq/shadcn-table-library) is rebuilt on the new components. |
| Delivery | **One sitting.** Parts run in the order of section 15 (A → B → D1 → C → D2 → E) with no review stop between them. The owner reviews the code and the documentation once everything is done. |

## Contents

1. [Decisions already made](#1-decisions-already-made)
2. [What exists today](#2-what-exists-today)
3. [Target architecture](#3-target-architecture)
4. [The new props](#4-the-new-props)
5. [Feature matrix: what gets combined](#5-feature-matrix-what-gets-combined)
6. [Part A — web: build, migrate, delete](#6-part-a--web-build-migrate-delete)
7. [Part B — web: ShadTable](#7-part-b--web-shadtable)
8. [Testing and verification](#8-testing-and-verification)
9. [Documentation updates](#9-documentation-updates)
10. [Risks](#10-risks)
11. [Questions — all answered](#11-questions--all-answered)
12. [Things this plan has not verified](#12-things-this-plan-has-not-verified)
13. [Part C — mobile kit](#13-part-c--mobile-kit)
14. [Part D — the two other repos](#14-part-d--the-two-other-repos)
15. [Order of the whole sitting](#15-order-of-the-whole-sitting)
16. [Part E — web consistency sweep (done last)](#16-part-e--web-consistency-sweep-done-last)

---

## 1. Decisions already made

These came from the owner on 2026-11-19 and are not reopened by this plan.

| # | Decision |
|---|---|
| D1 | Build a **new** component beside the two old ones. Delete the old ones only when the new one has every feature. |
| D2 | The new component has a **temporary name** (`UnifiedTable`) while it is built. The end product is `packages/ui/src/components/data-table.tsx` exporting `DataTable`. The temporary name must not survive. |
| D3 | The props are **redesigned from scratch**. A new developer reading the low-level component must understand at once what each prop is for. |
| D4 | Spreadsheet editing becomes **its own component with its own tests**. |
| D5 | The rendering engine is **private to `packages/ui`**. Apps cannot import it. |
| D6 | The **mobile kit is in scope**. |
| D7 | The grid's per-part class-name overrides are **dropped** from the public props. |
| D8 | **Every** ShadTable feature is built: F1–F16, all 19 recipes, and `animated-icons-table` (the `motion` package is added for it). Nothing is deferred. |
| D9 | **Spreadsheet formulas and A1 headers are built**, during the ShadTable stage (after the merge is finished). |
| D10 | Mobile gets every feature **in a phone-shaped form where one exists**. Print view is web only. |
| D11 | **No subagents.** All work is done in one thread. |
| D12 | **No review stops.** Prop types and the ADR are settled by the implementer in phase 0 and work continues. |
| D13 | **Single sitting**: Part A → B → C → D without pausing. |
| D14 | After this repo, **the same implementation** goes into `nextjs-admin-dashboard-layout` and `expo-boilerplate`: same names, same layout, same tests. |
| D15 | In the single-app repo, "private engine" means an `internal/` folder plus a lint rule (there is no package boundary). |
| D16 | The owner stops the dev servers before work starts, so the browser stage of `ci:local` can run. |
| D17 | The implementer never commits or pushes. The owner pushes the other thread's work first, then gives the start signal. |
| D18 | **Web consistency sweep, done last.** After the merge, ShadTable and the port to `nextjs-admin-dashboard-layout`, every low-level web component and its showcase must be identical in both web repos apart from imports (Part E, section 16). |
| D20 | **`expo-boilerplate` adopts the starter kit's formatter settings**, so the mobile files are identical byte for byte (section 16.9). |
| D19 | **Main course order:** (1) combine `data-grid` and `data-table`, (2) ShadTable on the combined table, (3) the same in `nextjs-admin-dashboard-layout`. The sweep starts only after all three. |

Temporary names used in this plan:

| Thing | Temporary name (phases 1–6) | Final name (phase 7) |
|---|---|---|
| Public table file | `packages/ui/src/components/unified-table.tsx` | `packages/ui/src/components/data-table.tsx` |
| Public table component | `UnifiedTable` | `DataTable` |
| Public spreadsheet file | `packages/ui/src/components/spreadsheet.tsx` | same |
| Private engine folder | `packages/ui/src/internal/table-engine/` | same |
| Private shell folder | `packages/ui/src/internal/unified-table/` | `packages/ui/src/internal/data-table/` |
| Shared logic folder | `packages/ui-kit-logic/src/table/` | same |

---

## 2. What exists today

### 2.1 The two components

| | `DataTable` (built in-house) | `DataGrid` (from reui.io, heavily adapted) |
|---|---|---|
| Files | `data-table.tsx` (1,418 lines), `data-table-rows.tsx` (627), `data-table-toolbar.tsx` (486), `data-table-types.ts` (245), `data-table-shared.tsx` (75), `data-table-pagination.tsx` (74) | `data-grid/` — 23 files, about 10,000 lines |
| Tests | 3 component test files + logic tests | 12 component test files |
| API style | One component, about 40 flat props. It calls `useTable` itself. | A provider plus parts. The page calls `useTable`, then nests `DataGrid` → `DataGridContainer` → `DataGridScrollArea` → `DataGridTable` → `DataGridPagination`. |
| Real pages | 19 files (18 in `apps/admin`, 1 in `apps/docs`) | **None.** Only the 34 showcase examples. |
| Showcase examples | 14 | 34 |
| Shared code between them | None. Neither imports the other. | |

### 2.2 Where each one is the stronger half

| Area | `DataTable` | `DataGrid` |
|---|---|---|
| Page chrome (title, toolbar, search, filter selects, result count) | ✅ | ❌ page builds it by hand |
| Bulk actions bar, select-all-across-pages | ✅ | ❌ only row checkboxes |
| Export (CSV, JSON, PDF, XLSX), with formula-injection sanitising | ✅ | ❌ |
| Mobile card view | ✅ | ❌ |
| Saved preferences (hidden/pinned columns, sort, page size) | ✅ | ❌ |
| Row actions menu (⋯) | ✅ | ❌ page builds it in a column |
| Empty state vs no-results state, error state | ✅ | 🟡 one empty message |
| Server mode (page, sort, filter owned by parent) | ✅ | 🟡 contract types only; page wires it |
| Sorting, pagination, row selection, column visibility, column pinning | ✅ | ✅ |
| Row drag | 🟡 native HTML drag, **pointer only** | ✅ dnd-kit, keyboard and screen-reader support |
| Row virtualisation | 🟡 hand-rolled, fixed row height | ✅ `@tanstack/react-virtual`, measured rows |
| Inline edit | 🟡 double-click text input | ✅ overlay editor, parse/format, validation rejection |
| Column resize, column drag, column move menu | ❌ | ✅ |
| Tree rows, expandable detail row, sub-table | ❌ | ✅ |
| Row pinning | ❌ | ✅ |
| Footers and totals | ❌ | ✅ |
| Infinite scroll (local and remote) | ❌ | ✅ |
| Column virtualisation | ❌ | ✅ |
| Layout flags (dense, striped, cell borders, sticky header, auto width) | ❌ | ✅ |
| Cell ranges, clipboard, fill handle (spreadsheet) | ❌ | ✅ |
| Row and cell status marks (new / dirty / deleted / invalid) | ❌ | ✅ |
| Multi-level headers, header col-span | ❌ | ✅ |

### 2.3 Everything that depends on them

| Dependent | Path | What changes |
|---|---|---|
| 18 admin pages | `apps/admin/contexts/*/components/*.tsx` | Props migrated in phase 6 |
| Docs endpoint explorer | `apps/docs/src/components/endpoints-explorer.tsx` | Props migrated in phase 6 |
| Mobile card helper | `apps/admin/lib/data-table/mobile-card.tsx` | Kept; type imports updated |
| Bulk selection helper | `apps/admin/lib/data-table/resolve-manual-bulk-selection.ts` | Updated to the new selection contract |
| URL selection state | `apps/admin/lib/url-state/selection.ts` | Checked against the new server query object |
| Showcase examples | `apps/admin/components/component-showcase/examples/data-table/`, `.../data-grid/` | Replaced in phase 5 |
| Showcase generated files | `apps/admin/components/component-showcase/generated/content/data-table.ts`, `data-grid.ts` | Regenerated with `pnpm --filter admin showcase:generate` |
| Home page | `apps/admin/app/(panel)/(home)/dashboard-gallery.tsx` (imports `data-table-14`) | Points to the new kitchen sink |
| Shared logic | `packages/ui-kit-logic/src/data-table/`, `.../data-grid/` | Web moves in Part A; the old folders are deleted in Part C |
| Web re-exports of logic | `packages/ui/src/lib/data-table/*.ts` | Replaced by `packages/ui/src/lib/table/*.ts` |
| Label families | `dataTable` and `dataGrid` in `packages/ui/src/lib/labels/ui-kit-labels.ts` and `messages/{en,ms,ta,zh-Hans}.json` | Merged; see phase 3 |
| Kit contract test | `packages/ui/src/__tests__/ui-kit-contract.test.ts` | File lists updated |
| Test harness | `packages/ui/src/testing/data-grid-test-harness.tsx` | Moved into the engine's test folder |
| Rules and docs | `rules/01`, `rules/03`, `rules/06`, `rules/24`, `README.md`, `docs/technical/api/list-queries.md`, `enhancements.md` | See section 9 |
| **Native kit** | `packages/ui-native/src/components/data-table.tsx` (1,372 lines), `data-grid.tsx` (1,222), `data-grid-parts.tsx` (553), `lib/data-table.ts`, `lib/data-grid.ts` | In scope — Part C (section 13) |
| Mobile showcase | `apps/mobile/src/features/showcase/examples/data-table/`, `.../data-grid/` (about 70 files) and its generated code | Replaced in Part C |

---

## 3. Target architecture

### 3.1 Layers

```
apps (smart layer: data, columns, labels, callbacks)
  │
  │  may import ONLY these two
  ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ components/data-table.tsx    │   │ components/spreadsheet.tsx   │
│ DataTable — records table    │   │ Spreadsheet — cell grid      │
└──────────────┬───────────────┘   └──────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ internal/data-table/         │   │ internal/spreadsheet/        │
│ shell: header, toolbar,      │   │ cell selection model,        │
│ filters, bulk bar, export,   │   │ clipboard, fill handle,      │
│ mobile cards, states, pager  │   │ overlay editor, selection bar│
└──────────────┬───────────────┘   └──────────────┬───────────────┘
               └────────────────┬─────────────────┘
                                ▼
               ┌──────────────────────────────────┐
               │ internal/table-engine/           │
               │ feature bundle, context, layout, │
               │ head, body, foot, resize, pin,   │
               │ dnd (rows + columns), virtual,   │
               │ scroll area, tree, expand        │
               └────────────────┬─────────────────┘
                                ▼
               ┌──────────────────────────────────┐
               │ @workspace/ui-kit-logic/table    │
               │ pure rules, no React, no DOM     │
               └──────────────────────────────────┘
```

### 3.2 How the engine is kept private (D5)

| Mechanism | Detail |
|---|---|
| Package `exports` | `packages/ui/package.json` exposes `./components/*` and `./lib/*`. A folder at `src/internal/` matches neither, so `@workspace/ui/internal/...` does not resolve from any app. |
| Lint | Add a pattern to `packages/oxlint-config/import-boundaries.js`: `^@workspace/ui/internal(/|$)` is forbidden outside `packages/ui`. This gives a clear message instead of a "module not found". |
| Contract test | Add a case to `packages/ui/src/__tests__/ui-kit-contract.test.ts`: no file under `apps/` or other packages imports `@workspace/ui/internal`. |
| Inside the package | `packages/ui/tsconfig.json` maps `@workspace/ui/*` → `src/*`, so `data-table.tsx` can import `@workspace/ui/internal/table-engine/...`. |

### 3.3 One feature bundle

Today there are two (`dataTableFeatures`, `dataGridFeatures`). The new engine has one, `tableEngineFeatures`, in `internal/table-engine/features.ts`.

| Source | Features |
|---|---|
| From both | `columnVisibilityFeature`, `columnPinningFeature`, `columnSizingFeature`, `columnFilteringFeature`, `columnFacetingFeature`, `globalFilteringFeature`, `rowSortingFeature`, `rowPaginationFeature`, `rowSelectionFeature`; sorted, filtered, paginated, faceted row models; faceted unique values |
| From `DataGrid` only | `columnOrderingFeature`, `columnResizingFeature`, `rowExpandingFeature`, `rowPinningFeature`, `cellSelectionFeature`, expanded row model, all six built-in `sortFns`, typed column `meta` via `metaHelper` |
| Added in Part B | `columnGroupingFeature`, grouped row model, `aggregationFns`, faceted min/max values |

`cellSelectionFeature` only seeds an empty state slice until a layout flag turns it on (the grid's own comment says so), so `DataTable` pays nothing for it. The 2,500 lines of cell-selection UI are imported only by `spreadsheet.tsx`.

Public type exports from `data-table.tsx`: `DataTableFeatures` (for `ColumnDef<DataTableFeatures, TData>`), `DataTableColumnMeta`, and the prop types. Nothing else from the engine is re-exported.

### 3.4 File-by-file destination

| Today | Destination | Treatment |
|---|---|---|
| `data-grid/data-grid.tsx` | `internal/table-engine/{features,context,layout-schema,auto-size,contracts}.ts(x)` | **Move and split** by concern (it is 1,168 lines). The spreadsheet callback types go to `internal/spreadsheet/contracts.ts`. |
| `data-grid/data-grid-table.tsx` | `internal/table-engine/table.tsx` | Move |
| `data-grid/data-grid-table-head.tsx`, `-body.tsx`, `-layout.tsx`, `-fill.tsx`, `-resize.tsx`, `-affordances.tsx` | `internal/table-engine/` (same names without the `data-grid-` prefix) | Move |
| `data-grid/data-grid-table-dnd.tsx`, `-dnd-rows.tsx` | `internal/table-engine/dnd-columns.tsx`, `dnd-rows.tsx` | Move |
| `data-grid/data-grid-table-virtual.tsx` | `internal/table-engine/virtual.tsx` | Move |
| `data-grid/data-grid-scroll-area.tsx` | `internal/table-engine/scroll-area.tsx` | Move |
| `data-grid/data-grid-column-header.tsx` | `internal/table-engine/column-header.tsx` | Move; gains the sort-cycle option from `DataTable` |
| `data-grid/data-grid-column-filter.tsx` | `internal/data-table/filter-multi-select.tsx` | Move; becomes one of the toolbar filter kinds |
| `data-grid/data-grid-column-visibility.tsx` | `internal/data-table/column-menu.tsx` | Merge with `ColumnVisibilityMenu` from `data-table-toolbar.tsx` |
| `data-grid/data-grid-pagination.tsx` | `internal/data-table/pager.tsx` | Merge with the pager in `data-table.tsx` and `data-table-pagination.tsx` |
| `data-grid/data-grid-cell-selection*.ts(x)` (6 files) | `internal/spreadsheet/` | Move |
| `data-grid/data-grid-i18n.tsx` | deleted | Labels resolved once in `data-table.tsx` |
| `data-table.tsx` | `components/unified-table.tsx` + `internal/unified-table/use-table-state.ts` | **Rewrite.** The state logic (prefs, server mode, debounce, selection scope) is ported; the render body is replaced by engine parts. |
| `data-table-toolbar.tsx` | `internal/unified-table/{toolbar,filter-select,export-menu,bulk-bar,mobile-selection-bar}.tsx` | Move and split |
| `data-table-rows.tsx` | `internal/unified-table/{row-actions-menu,mobile-card-view,no-results}.tsx` | Keep these three. **Delete** `HeaderCell`, `TableRowView`, `TableCellView`, `InlineEditInput`, `DragHandleCell`, `SkeletonRow`, `SelectAllCheckbox`, `SelectRowCheckbox` — the engine has better versions. |
| `data-table-shared.tsx` | split between engine and shell | `buildPinnedColumnStyles`, `PIN_SHADOW_*` deleted (engine pins with `getPinningStyles`) |
| `data-table-pagination.tsx` | merged into `internal/unified-table/pager.tsx` | |
| `data-table-types.ts` | `components/unified-table.tsx` exports + `internal/unified-table/props.ts` | Rewritten (section 4) |
| `packages/ui/src/lib/data-table/*.ts` | `packages/ui/src/lib/table/*.ts` | Re-export shims over the new logic folder |
| `packages/ui-kit-logic/src/data-table/*`, `data-grid/*` | `packages/ui-kit-logic/src/table/*` | Web moves first (Part A). The old folders stay until the mobile kit has moved too (Part C), then they are deleted. |

---

## 4. The new props

### 4.1 Design rules

| Rule | Why |
|---|---|
| One prop per **job**, named after the job (`search`, `filters`, `selection`, `editing`, `exporting`). | A reader sees the feature list by reading the prop list. |
| A feature is **off when its prop is absent**. No `enableX` booleans beside an `onX` callback. | Removes the "which two props must I set together?" question. |
| Each prop is an object whose fields belong only to that feature. | Today `sorting`, `onManualSortingChange`, `manualColumnFilters`, `onManualColumnFilterChange` and `pagination.mode` together mean "server mode". |
| Server mode is **one discriminated union**. | The compiler rejects a half-configured server table. |
| No domain words, no hardcoded copy. Every string comes from `labels` or the caller. | Rule 07 "Low-level data rule". |
| Controlled or uncontrolled is chosen per feature and documented on the prop. | Rule 07 "Controlled vs uncontrolled". |
| Rows are always addressed by **id**, never by index. `getRowId` is required. | Today `onCellEdit` and `onRowReorder` pass indexes and warn in comments that they are unreliable. |
| Every prop has a one-line JSDoc that says what the user sees. | D3. |

### 4.2 The prop list

Shown as a sketch. Exact types are fixed in phase 0 and recorded in the ADR.

```tsx
<DataTable
	// ── 1. The records ─────────────────────────────────────────────
	data={rows}                       // the rows; in server mode, the current page only
	columns={columns}                 // ColumnDef<DataTableFeatures, TData>[]
	getRowId={(row) => row.id}        // required: every feature addresses rows by id

	// ── 2. Where the rows come from ────────────────────────────────
	source={{ mode: "client" }}       // default
	// source={{ mode: "server", totalCount, query, onQueryChange, onFetchAllMatching }}
	// source={{ mode: "infinite", hasMore, isFetchingMore, onLoadMore }}

	// ── 3. Chrome ──────────────────────────────────────────────────
	heading={{ title, description, actions }}
	toolbar={{ layout: "inline" | "fill", extra }}
	footer={{ rows }}                 // totals / summary rows

	// ── 4. Status ──────────────────────────────────────────────────
	status={{ loading: false | "initial" | "refreshing", error, onRetry, skeletonRows }}
	emptyState={{ icon, title, description, action }}

	// ── 5. Finding rows ────────────────────────────────────────────
	search={{ columns, debounceMs }}
	filters={[
		{ kind: "select", column: "status", label, options },
		{ kind: "multi-select", column: "type", label, options },
		{ kind: "date-range", column: "createdAt", label },        // Part B
	]}
	sorting={{ cycle: "asc-desc" | "asc-desc-none" }}
	paging={{ pageSize: 10, pageSizeOptions }}   // absent = no pager

	// ── 6. Acting on rows ──────────────────────────────────────────
	onRowClick={(row) => …}
	rowActions={[{ key, label, icon, onSelect, tone: "default" | "destructive" }]}
	selection={{ bulkActions, onDelete, scope, onScopeChange }}
	exporting={{ formats, filename, columns }}

	// ── 7. Row structure ───────────────────────────────────────────
	tree={{ getSubRows, defaultExpanded, indent }}
	detail={{ render, mode: "row" | "panel" }}   // "panel" arrives in Part B
	grouping={{ by, aggregate }}                 // Part B
	rowReorder={{ onReorder }}                   // (activeId, overId) — ids, not indexes
	rowPinning={true}
	rowStatus={(row) => "new" | "dirty" | "deleted" | undefined}

	// ── 8. Columns ─────────────────────────────────────────────────
	columnControls={{ visibility: true, pinning: true, resizing: true, reordering: true }}

	// ── 9. Editing ─────────────────────────────────────────────────
	editing={{ onCellEdit, trigger: "double-click" | "click" }}
	// which columns are editable is declared on the column: meta.edit = { parse, format, validate }

	// ── 10. Look ───────────────────────────────────────────────────
	layout={{ density, striped, cellBorders, stickyHeader, width, maxHeight }}
	virtualize={{ rows: true, columns: false, estimateRowHeight }}
	mobileCard={(row, rowActions) => …}

	// ── 11. Remembering ────────────────────────────────────────────
	preferences={{ key, storage }}

	// ── 12. Standard ───────────────────────────────────────────────
	labels={…} className={…} ref={…}
/>
```

### 4.3 Old prop → new prop

| Old `DataTable` prop | New prop | Note |
|---|---|---|
| `data`, `columns` | `data`, `columns` | Unchanged |
| `pagination.getRowId` | `getRowId` | Now required at the top level |
| `pagination: { mode: "client", defaultPageSize }`, `pageSize`, `pageSizeOptions` | `paging: { pageSize, pageSizeOptions }` | Three props become one |
| `pagination: { mode: "server", totalCount, pageIndex, pageSize, onPageChange, resetKey, onFetchAllMatching, onClearFilters, isFiltered }` | `source: { mode: "server", totalCount, query, onQueryChange, onFetchAllMatching }` | `query` holds page, page size, sorting, filters, search |
| `sorting`, `onManualSortingChange` | `source.query.sorting`, `source.onQueryChange` | Folded into the server query |
| `manualColumnFilters`, `onManualColumnFilterChange` | `source.query.filters`, `source.onQueryChange` | Folded into the server query |
| `title`, `description` | `heading: { title, description, actions }` | |
| `toolbarLayout`, `toolbarContent` | `toolbar: { layout, extra }` | |
| `searchKeys`, `searchDebounceMs` | `search: { columns, debounceMs }` | |
| `filters: Filter[]` (`key`) | `filters: [{ kind: "select", column, … }]` | `key` renamed to `column`; new kinds |
| `actions: Action[]` (`onClick`, `variant`, `isDestructive`, `iconBgColor`, `className`) | `rowActions: [{ onSelect, tone }]` | Two destructive flags collapse into `tone`; styling props removed |
| `checkbox: true \| { bulkActions, onDeleteAll, export, exportFilename, exportableColumns }` | `selection: { bulkActions, onDelete }` + `exporting: { formats, filename, columns }` | Export no longer hides inside the checkbox config |
| `selectAllPages`, `onSelectAllPagesChange` | `selection.scope` (`"page" \| "all-matching"`), `selection.onScopeChange` | |
| `enableColumnVisibility`, `enableColumnPinning` | `columnControls: { visibility, pinning }` | |
| `persistKey`, `storage` | `preferences: { key, storage }` | |
| `editable`, `editableColumns`, `onCellEdit(rowIndex, columnId, value, row)` | `editing: { onCellEdit({ rowId, columnId, value, previousValue, row }) }` + `meta.edit` on the column | By id |
| `draggable`, `onRowReorder(fromIndex, toIndex, rows)` | `rowReorder: { onReorder({ activeId, overId, orderedIds }) }` | By id; keyboard support |
| `virtualizeRows`, `virtualRowHeight`, `maxHeight` | `virtualize: { rows, estimateRowHeight }`, `layout.maxHeight` | |
| `isLoading`, `isRefetching`, `skeletonRows`, `error` | `status: { loading, error, onRetry, skeletonRows }` | `onRetry` is new |
| `sortCycle` | `sorting: { cycle }` | |
| `emptyState`, `mobileCardRender`, `onRowClick`, `labels`, `className`, `ref` | `emptyState`, `mobileCard`, `onRowClick`, `labels`, `className`, `ref` | |

### 4.4 `Spreadsheet` props (own component, D4)

```tsx
<Spreadsheet
	data={rows} columns={columns} getRowId={…}
	onCellsChange={(batch) => …}          // paste, cut, clear, fill, edit — one batch per operation
	onCellEditRequest={…} onSelectionChange={…} onCopy={…}
	selectionMode="range" | "single"
	fillHandle={{ variant: "dot" | "ring" | "square" }}
	editing={{ trigger: "double-click" | "click", enterAdvances: true }}
	rowStatus={…} cellStatus={…}
	draftRow={{ render, onCreate, label }}
	layout={{ density, cellBorders, stickyHeader, maxHeight }}
	virtualize={{ rows, columns }}
	labels={…} className={…} ref={…}       // ref exposes the selection API
/>
```

It shares the engine, so it also gets sorting, pinning, resizing and virtualisation. It has no toolbar, no bulk bar, no mobile cards and no pager: those belong to a records table.

---

## 5. Feature matrix: what gets combined

"Winner" is the implementation that is moved. "Port" is behaviour taken from the loser and added to the winner.

### 5.1 Features both have

| # | Feature | Winner | Port from the loser |
|---|---|---|---|
| 1 | Sorting | Engine (`column-header.tsx`) | `sortCycle` (`asc-desc-none`); controlled sorting; persistence to prefs; `aria-sort` kept from the engine |
| 2 | Pagination | Engine pager (`getDataGridPaginationItems`) | "Showing X to Y of Z", "Page X of Y", page-size select with linked labels, refetch spinner, server range maths |
| 3 | Row selection | Engine checkboxes | `table.Subscribe` islands so a toggle re-renders only the checkbox and the bulk bar; select-all-pages scope; reset on server page change |
| 4 | Column visibility | Engine menu | Persistence; utility columns excluded |
| 5 | Column pinning | Engine (`getPinningStyles`, sticky z-index scale) | Start → end → unpinned cycle; persistence |
| 6 | Row drag | Engine (dnd-kit) | Nothing. The native-drag code is deleted. This is an **accessibility upgrade**: keyboard reordering starts to work. |
| 7 | Inline edit | Engine overlay editor + `meta.edit` | Double-click trigger and Enter/Escape stay. Callback is by row id. |
| 8 | Row virtualisation | Engine (`@tanstack/react-virtual`) | Scroll reset on sort, filter and page change |
| 9 | Loading skeleton | Engine (`meta.skeleton` per column) | `skeletonRows`; `aria-busy` status region; refetch dim |
| 10 | Server mode | Shell state logic from `DataTable` | Mapped onto the engine's `manual*` options through the single `source.query` object |
| 11 | Row click | Engine | Enter/Space activation; ignore clicks on interactive children (`isDataGridCellInteractiveTarget`) |
| 12 | Column filter | Both, as two `kind`s | `select` (single, with facet counts) from `DataTable`; `multi-select` (searchable) from `DataGrid` |

### 5.2 Features only `DataTable` has (all kept)

| # | Feature | Source | Destination |
|---|---|---|---|
| 13 | Title and description header | `data-table.tsx` | `internal/unified-table/heading.tsx` |
| 14 | Toolbar: search with clear button, debounce, live result count | `data-table.tsx` | `toolbar.tsx` |
| 15 | Toolbar layouts `inline` / `fill` | `data-table.tsx` | `toolbar.tsx` |
| 16 | Custom toolbar content | `toolbarContent` | `toolbar.extra` |
| 17 | Row actions ⋯ menu | `RowActionsMenu` | `row-actions-menu.tsx` |
| 18 | Bulk selection bar, bulk actions, bulk delete | `BulkSelectionBar` | `bulk-bar.tsx` |
| 19 | "Select all N rows" banner, cross-page scope | `data-table.tsx` | `bulk-bar.tsx` |
| 20 | Export CSV / JSON / PDF / XLSX, chosen columns, filename, fetch-all in server mode, cell sanitising | `ExportMenu`, `lib/data-table/export.ts` | `export-menu.tsx`, `lib/table/export.ts` |
| 21 | Mobile cards below the desktop breakpoint, with selection | `MobileCardView`, `MobileSelectionBar` | `mobile-card-view.tsx` |
| 22 | Saved preferences with a pluggable storage adapter and reconciliation against current columns | `lib/data-table/prefs.ts`, `storage.ts` | `lib/table/prefs.ts`; extended with column order, column sizes and density |
| 23 | Empty state (no data) vs no-results state (filters hide everything, with "clear filters") | `data-table.tsx`, `NoResults` | `states.tsx` |
| 24 | Error state | `data-table.tsx` | `states.tsx`; gains `onRetry` |
| 25 | Guards: unique column ids, filters must name a column | `column-ids.ts` | `ui-kit-logic/table/column-ids.ts` |
| 26 | Exact-match default filter function for selects | `SELECT_FILTER_COLUMN_DEFAULTS` | `use-table-state.ts` |

### 5.3 Features only `DataGrid` has

| # | Feature | Exposed on `DataTable` as | Notes |
|---|---|---|---|
| 27 | Column resizing (mouse, touch, keyboard; `onChange` / `onEnd`) | `columnControls.resizing` | Sizes saved in preferences |
| 28 | Column drag reorder | `columnControls.reordering` | Order saved in preferences |
| 29 | Column header menu (sort, pin, move, hide) | Automatic when any `columnControls` flag is on | |
| 30 | Auto-size and fill-width columns | `meta.autoSize`, `meta.fillWidth` | |
| 31 | Multi-level headers, header col-span | Column groups in `columns`; `meta.headerColSpan` | |
| 32 | Column icons, header/cell class names | `meta.headerClassName`, `meta.cellClassName` | |
| 33 | Tree rows with indent | `tree` | |
| 34 | Expandable detail row | `detail: { mode: "row" }` | Replaces `meta.expandedContent` on a column, which hid a table-level feature inside a column |
| 35 | Sub-table in a detail row | `detail.render` returning a nested `DataTable` | |
| 36 | Row pinning (top / bottom) | `rowPinning` | |
| 37 | Footer rows: totals, summary, aggregate | `footer` | |
| 38 | Infinite scroll, local and remote | `source: { mode: "infinite" }` | |
| 39 | Column virtualisation | `virtualize.columns` | |
| 40 | Layout: dense, striped, cell borders, row borders, rounded rows, header background, sticky header, auto/fixed width | `layout` | `dense: boolean` becomes `density` in Part B |
| 41 | Row status tint (new / dirty / deleted) | `rowStatus` | |
| 42 | Loading mode spinner vs skeleton | `status.loading` + `layout` | |
| 43 | Custom scroll area with styled scrollbars | Internal, always on | |
| 44 | Per-part class name overrides (`tableClassNames`) | **Dropped from the public API** | A dumb component with 14 class-name hooks invites one-off restyling. `className` on the root stays. Reconsider only if a real page needs it. |

### 5.4 Features that move to `Spreadsheet`

| # | Feature |
|---|---|
| 45 | Cell range selection (mouse, Shift, Ctrl/Cmd, keyboard) |
| 46 | Copy, cut, paste (TSV + HTML), tiling a block over a larger range |
| 47 | Fill handle (three looks) |
| 48 | Type-to-replace, F2 / Enter editing, Enter-advances |
| 49 | Cell status marks (dirty / invalid), rejected-cell reporting |
| 50 | Selection bar (count, actions) |
| 51 | Draft row and "add row" affordance |

---

## 6. Part A — web: build, migrate, delete

Old components stay untouched and working until phase 7. Scoped checks run after every phase; the full gate runs once, at the very end of the sitting (section 8).

Because there are no review stops (D12), a progress log is kept in `docs/history/PROGRESS-<date>-data-table-unification.md` and updated after every step: what was finished, what was decided and why, what is next. It is the record the owner reviews, and it lets the work resume correctly after the conversation context is summarised.

### Phase 0 — Contract (no source code)

| Step | Work | Output |
|---|---|---|
| 0.1 | Read every file of both components line by line. Fill a behaviour inventory: each prop, each keyboard key, each ARIA attribute, each label key, each edge case noted in comments. | Appendix A of this document |
| 0.2 | Read the 19 real consumers and record which props each uses. | Appendix B: page × prop table |
| 0.3 | Resolve every "winner / port" row in section 5 against the real code. Flag any that turn out wrong. | Updated section 5 |
| 0.4 | Fix the exact TypeScript of every prop in section 4, including the `source` union and the `filters` union. | `internal/unified-table/props.ts` drafted in the ADR, not in code |
| 0.5 | Write ADR `095-one-data-table.md`: the decision, the layering, the private engine, the dropped items (5.3 row 44), the ShadTable licence note. | ADR |
| 0.6 | No owner stop here (D12). The implementer settles the types, records each choice and its reason in the ADR and the progress log, and continues. | ADR marked "accepted by delegation, for owner review at the end" |

### Phase 1 — Engine moves into `internal/table-engine/`

| Step | Work |
|---|---|
| 1.1 | Create `packages/ui/src/internal/table-engine/`. **Copy** (not move) the engine files listed in 3.4 so `data-grid/` keeps working. |
| 1.2 | Rename symbols from `DataGrid*` to `TableEngine*`. Split `data-grid.tsx` into `features.ts`, `context.tsx`, `layout-schema.ts`, `auto-size.ts`, `contracts.ts`. |
| 1.3 | Build `tableEngineFeatures` (section 3.3) and the merged column `meta` type. |
| 1.4 | Copy the 9 engine test files and the test harness into `internal/table-engine/__tests__/`; make them pass against the new names. |
| 1.5 | Add the `exports` guard, the lint pattern and the contract-test case from 3.2. |
| **Exit** | Engine tests green. `data-grid/` untouched. No app can import the engine (proved by the contract test). |

### Phase 2 — `UnifiedTable` renders a basic table

| Step | Work |
|---|---|
| 2.1 | Create `packages/ui-kit-logic/src/table/` with the contracts needed so far: row id reader, pagination maths, label formatter, column-id guards. Tests in `__tests__/`. |
| 2.2 | Create `internal/unified-table/props.ts` from the approved ADR types. |
| 2.3 | Create `internal/unified-table/use-table-state.ts`: the single `useTable` call, client mode only. Ports the memoised options object and the narrow state selector from `data-table.tsx`. |
| 2.4 | Create `components/unified-table.tsx`: heading + engine table + pager. Props live: `data`, `columns`, `getRowId`, `heading`, `sorting`, `paging`, `layout`, `labels`, `className`, `ref`. |
| 2.5 | Tests: renders rows, sorts (both cycles), pages, page-size change, `aria-sort`, axe pass. |
| **Exit** | Showcase example "Overview" runs on `UnifiedTable`. |

### Phase 3 — The shell moves on top

One feature per step. Each step ends with its tests green.

| Step | Feature (matrix #) | Work |
|---|---|---|
| 3.1 | Status (9, 23, 24) | `states.tsx`: initial skeleton, refresh dim, error with retry, empty, no-results with clear-filters |
| 3.2 | Search (14) | `toolbar.tsx`: input, clear, debounce, result count; `globalFilterFn` over `search.columns` |
| 3.3 | Filters (12, 15, 16) | `filter-select.tsx` and `filter-multi-select.tsx`; facet counts; `fill` layout; `toolbar.extra` |
| 3.4 | Row actions (17) | `row-actions-menu.tsx`; utility column injected by the shell |
| 3.5 | Selection (3, 18, 19) | Engine checkboxes + `bulk-bar.tsx`; scope `page` / `all-matching`; subscribe islands |
| 3.6 | Export (20) | `export-menu.tsx`; `exporting` prop separated from `selection` |
| 3.7 | Column controls (4, 5, 27, 28, 29) | Visibility, pinning, resizing, reordering through the engine header menu |
| 3.8 | Preferences (22) | Extend the prefs schema with `columnOrder`, `columnSizing`; keep the storage adapter contract; version the storage key (`datatable:v2:`) so old saved prefs are ignored, not misread |
| 3.9 | Server source (10) | `source: { mode: "server" }`; one `query` object; reset selection when the page, page size or `data` changes; fetch-all for export and bulk |
| 3.10 | Mobile cards (21) | `mobile-card-view.tsx`, `mobile-selection-bar.tsx` |
| 3.11 | Labels | Merge the `dataGrid` label keys the table needs into the `dataTable` family; add a `spreadsheet` family; update `en/ms/ta/zh-Hans.json`. The old `dataGrid` family stays until phase 7. |
| **Exit** | Every `DataTable`-only feature in 5.2 works on `UnifiedTable`. The 14 old `data-table-N` showcase examples have a working twin. |

### Phase 4 — Grid-only features become props

| Step | Feature (matrix #) | Prop |
|---|---|---|
| 4.1 | Inline edit (7) | `editing` + `meta.edit` |
| 4.2 | Row reorder (6) | `rowReorder` |
| 4.3 | Row virtualisation, column virtualisation (8, 39) | `virtualize` |
| 4.4 | Tree rows (33) | `tree` |
| 4.5 | Detail row and sub-table (34, 35) | `detail: { mode: "row" }` |
| 4.6 | Row pinning (36) | `rowPinning` |
| 4.7 | Footer (37) | `footer` |
| 4.8 | Infinite source (38) | `source: { mode: "infinite" }` |
| 4.9 | Row status (41) | `rowStatus` |
| 4.10 | Multi-level headers, auto-size, fill-width (30, 31, 32) | Column defs and `meta` |
| **Exit** | Every row of 5.1–5.3 is implemented and tested. |

### Phase 5 — `Spreadsheet` and the showcase

| Step | Work |
|---|---|
| 5.1 | Create `internal/spreadsheet/` from the 6 cell-selection files; create `components/spreadsheet.tsx` (section 4.4). |
| 5.2 | Move the 3 cell-selection test files; add tests for the new props. |
| 5.3 | New showcase folder `examples/unified-table/` with one example per feature (list below). New folder `examples/spreadsheet/`. |
| 5.4 | Write `docs.md`, `overview.md`, `features.json`, `guidelines.json`, do/don't examples for both. |
| 5.5 | Run `pnpm --filter admin showcase:generate`. |

Target example list for `DataTable` (one example per row, per the gallery preference):

| # | Example | Replaces |
|---|---|---|
| 1 | Overview | table-1, grid-1 |
| 2 | Search and filters (select + multi-select) | table-2 |
| 3 | Row actions | table-3 |
| 4 | Bulk selection | table-4, grid-7 |
| 5 | Export | table-5 |
| 6 | Inline editing | table-6 |
| 7 | Drag to reorder rows | table-7, grid-14 |
| 8 | Column visibility and pinning | table-8, grid-16, grid-20 |
| 9 | Column resizing | grid-15 |
| 10 | Column reordering (menu and drag) | grid-12, grid-13 |
| 11 | Column header controls | grid-10, grid-11, grid-18 |
| 12 | Pagination and sorting | table-9 |
| 13 | Layout: density, borders, stripes, sticky header, auto width | grid-2, 3, 4, 5, 6, 17, 19 |
| 14 | Mobile cards | table-10 |
| 15 | Loading, empty and error | table-11, grid-21 |
| 16 | Virtualised rows | table-12 |
| 17 | Virtualised columns | grid-32 |
| 18 | Server source | table-13, grid-34 |
| 19 | Infinite source, local | grid-27 |
| 20 | Infinite source, remote | grid-28 |
| 21 | Tree rows | grid-30 |
| 22 | Detail row | grid-8 |
| 23 | Sub-table | grid-9 |
| 24 | Row pinning | grid-29 |
| 25 | Footer totals / summary / aggregate | grid-24, 25, 26 |
| 26 | CRUD with row status | grid-22, 23 |
| 27 | Localised labels | grid-33 |
| 28 | Saved preferences | (new) |
| 29 | Kitchen sink (home page) | table-14 |

`Spreadsheet` examples: overview, clipboard and fill, validation and status marks, draft row (replaces grid-31).

### Phase 6 — Migrate the 19 real pages

One context at a time. After each row: scoped lint, typecheck and that context's tests.

| Order | Context | Files | Props in play |
|---|---|---|---|
| 1 | docs | `apps/docs/src/components/endpoints-explorer.tsx` | `toolbar.layout: "fill"`, filters |
| 2 | reference-data | `geo-table.tsx` | Smallest admin table; proves the pattern |
| 3 | catalog | `product-view.tsx`, `sample-category-view.tsx` | |
| 4 | notifications | `email-log-table.tsx` | Server source |
| 5 | webhooks | `received-webhooks-table.tsx` | Server source |
| 6 | audit | `audit-log-table.tsx` | Server source, compact layout |
| 7 | docs-publishing | `docs-sync-view.tsx` | |
| 8 | operations | `operations-overview.tsx`, `ops-alerts-view.tsx`, `load-test-detail.tsx`, `load-tests-view.tsx`, `server-detail.tsx`, `backups-view.tsx` | |
| 9 | authorization | `support-access-console.tsx` | |
| 10 | identity | `users-all-table.tsx`, `mfa-recovery-queue.tsx` | Bulk selection, export |
| 11 | tenancy | `merchants-all-table.tsx` | Bulk selection, export |
| 12 | helpers | `apps/admin/lib/data-table/mobile-card.tsx`, `resolve-manual-bulk-selection.ts`, `apps/admin/lib/url-state/selection.ts` | |

The order above is provisional; Appendix B (phase 0.2) may reorder it by real prop usage.

### Phase 7 — Rename and delete

| Step | Work |
|---|---|
| 7.1 | Confirm with a search that nothing imports `@workspace/ui/components/data-table`, `.../data-grid/*`, `@workspace/ui/lib/data-table/*`. |
| 7.2 | Delete `packages/ui/src/components/data-table.tsx`, `data-table-rows.tsx`, `data-table-toolbar.tsx`, `data-table-types.ts`, `data-table-shared.tsx`, `data-table-pagination.tsx` and their 3 test files. |
| 7.3 | Delete `packages/ui/src/components/data-grid/` (23 files + 12 tests) and `packages/ui/src/testing/data-grid-test-harness.tsx`. |
| 7.4 | Delete `packages/ui/src/lib/data-table/`. Delete the `dataGrid` label family and its keys in the four language files. |
| 7.5 | Delete `apps/admin/components/component-showcase/examples/data-table/` and `.../data-grid/`. |
| 7.6 | Rename: `unified-table.tsx` → `data-table.tsx`, `UnifiedTable` → `DataTable`, `internal/unified-table/` → `internal/data-table/`, `examples/unified-table/` → `examples/data-table/`. Update the 19 pages' import path (one line each). |
| 7.7 | `ui-kit-logic`: the old `data-table/` and `data-grid/` folders **stay for now**, because the mobile kit still imports them. They are deleted in Part C. |
| 7.8 | Regenerate the showcase. Update the contract test's file lists. |
| 7.9 | Documentation (section 9). |
| 7.10 | Scoped checks for `@workspace/ui`, `@workspace/ui-kit-logic`, `admin`, `docs`. The full gate runs at the end of the sitting. |

Deletions use `git rm` on named files and folders, never `rm -rf`.

---

## 7. Part B — web: ShadTable

Everything in this part is built (D8, D9): the 16 features, the spreadsheet formula engine, all recipes, and the animated-icons example.

### 7.1 Why it is not installed

| Fact (checked against their `registry.json` and v9 item files on 2026-11-19) | Consequence |
|---|---|
| 50 registry items; each has a v8 and a `-v9` variant (`https://www.shad-table.dev/r/<name>-v9.json`, pinned to `@tanstack/react-table@^9.2.4`) | Only the v9 variants are relevant to us |
| Items depend on shadcn primitives in the `new-york` (Radix) style | Rule 07 allows Base UI only; our `components.json` is `base-vega` |
| Their code uses `ColumnDef<…, any>`, `as` casts, `typeof` checks, numeric array indexes, hardcoded English copy | Fails our lint and non-negotiables |
| Every item is a separate standalone table with its own `useTable` | Would recreate the two-tables problem fifty times |
| Server examples use TanStack Start route loaders | We use Next.js + TanStack Query + URL state |
| Their bundle registers `stockFeatures` and every fn registry | We register only what `DataTable` uses |
| MIT licence | We may read and re-implement; the ADR and each ported file's header credit the source |

So each pattern is **re-implemented** as either a `DataTable` feature (engine or shell) or a showcase recipe that uses the public `DataTable` only.

### 7.2 New features to build

Each one is a prop on the single `DataTable`. Order is the proposed build order.

| ID | Feature | Their reference item(s) | How it is built here | New prop |
|---|---|---|---|---|
| F1 | **Density** (compact / comfortable / spacious), switchable by the user, saved | `density-export-table` | Replace the engine's `dense: boolean` with a three-value CVA variant on header, body and footer cells. Toolbar control. Saved in preferences. | `layout.density`, `columnControls.density` |
| F2 | **Date-range filter** | `logs-table` (`date-range-filter.tsx`, `inDateRange`) | New filter kind using our existing `calendar.tsx` / `date-picker.tsx` (react-day-picker is already a dependency). Pure `isWithinDateRange` in `ui-kit-logic/table/filters.ts`, registered as a `filterFn`. In server mode the range goes into `source.query.filters`. | `filters: [{ kind: "date-range" }]` |
| F3 | **Multi-select filter with live counts** | `logs-table` (`faceted-filter.tsx`), `crm-employees-multi-select-table`, `deployments-table` | Already moved in phase 3.3 from `DataGridColumnFilter`. Part B adds: counts that reflect the other active filters, "clear" per filter, selected-values summary on the trigger. | `filters: [{ kind: "multi-select" }]` |
| F4 | **Detail panel** beside the table, with ↑/↓ to move between rows and Escape to close | `logs-table-side-panel`, `split-detail-table`, `tree-table-detail-card`, `change-review-table` | `detail.mode: "panel"`. Layout with our `resizable.tsx`; on narrow screens it becomes our `sheet.tsx`. Roving focus on rows, `aria-selected`. Optional `hideColumnsWhileOpen`. Closes itself when a filter removes the open row. | `detail: { mode: "panel", render, hideColumnsWhileOpen }` |
| F5 | **Grouping with subtotals** | `grouped-table` | Add `columnGroupingFeature`, grouped row model and `aggregationFns` to the bundle. Engine body learns to draw group header rows (collapsible, reuses the expand affordance) and aggregated cells. | `grouping: { by, aggregate, defaultExpanded }` |
| F6 | **Pivot** | `pivot-table` (`pivot.ts`) | Pure `pivotRows(rows, rowDimension, columnDimension, aggregation)` in `ui-kit-logic/table/pivot.ts`, returning rows, dynamic column keys, column totals and a grand total. A recipe turns that into `columns` + `footer` for `DataTable`. No new prop: a pivot is a data transform, which belongs to the smart layer. | none (helper + recipe) |
| F7 | **Edit validation, optimistic save, undo** | `editable-table`, `inventory-allocation-table` | `meta.edit.validate(raw, row)` returns a message; the editor shows it and blocks commit. `editing.onCellEdit` may return a promise: the cell shows pending, then reverts with the message on rejection. Undo is a pure `EditHistory` (push / undo / redo) in `ui-kit-logic`; `DataTable` shows the control and calls `editing.onUndo`. The caller still owns the data. | `editing: { history, onUndo, onRedo }`, `meta.edit.validate` |
| F8 | **Row action state** (pending spinner, failed → retry) | `async-actions-table` | `rowActions[].onSelect` may return a promise; the menu item and an optional inline button reflect pending and failure. | `rowActions[].inline`, promise-returning `onSelect` |
| F9 | **Tree search that keeps ancestors visible** | `tree-table` | `filterFromLeafRows` + auto-expand matching branches in `use-table-state.ts` when both `tree` and `search` are set. | none (behaviour) |
| F10 | **Cascading tree selection** with indeterminate parents | `tree-table-selection` | Verify the engine's sub-row selection; add indeterminate state to the row checkbox and select-all. | `selection.cascade` |
| F11 | **Reorder within the same parent** in a tree | `tree-table-reorder` | Constrain the dnd-kit drop target to siblings when `tree` is set. | none (behaviour) |
| F12 | **Error banner over stale rows** | `error-state-table` | `status.error` with existing rows shows a banner with retry above the table; without rows it shows the full panel. | none (behaviour of `status`) |
| F13 | **Export dialog**: pick columns, format, scope (selected / filtered / all), with a row-count preview | `export-config-table`, `export-selected-table` | `exporting.mode: "dialog"` using our `dialog.tsx`. Reuses the existing export builders and sanitiser. | `exporting.mode` |
| F14 | **Print view** | `density-export-table` | `print:` styles on the engine: toolbar and pager hidden, all rows shown, borders on. Our existing PDF export stays. | none (styles) |
| F15 | **Mobile cards by container width** | `mobile-cards-table` | Switch from a viewport media query to a container query so a table in a narrow panel (for example beside the F4 panel) also becomes cards. | `mobileCard` unchanged |
| F16 | **Draft rows** | `draft-rows-table` | The engine already has `appendRow`, `onRowCreate` and row status. Expose them on `DataTable`. | `draftRows: { render, onCreate, label }` |

### 7.3 All 50 ShadTable items, classified

| # | Their item | Bucket | Result here |
|---|---|---|---|
| 1 | `data-table` | Covered | Example 1 |
| 2 | `server-pagination-table` | Covered | Example 18; recipe note for URL state with `apps/admin/lib/url-state` |
| 3 | `server-filter-table` | Covered | Example 18 |
| 4 | `server-combined-table` | Covered | Example 18 |
| 5 | `deployments-table` | Recipe | Needs F3 |
| 6 | `logs-table` | Feature + recipe | F2, F3 |
| 7 | `logs-table-side-panel` | Feature | F4 |
| 8 | `tree-table` | Covered + feature | Example 21; F9 |
| 9 | `tree-table-variants` | Recipe | On `tree` + `selection` |
| 10 | `tree-table-detail-card` | Feature | F4 with `tree` |
| 11 | `tree-table-selection` | Feature | F10 |
| 12 | `tree-table-reorder` | Feature | F11 |
| 13 | `reorderable-table` | Covered | Example 7 |
| 14 | `resizable-reorderable-columns-table` | Covered | Examples 9, 10, 28 (layout saved through preferences) |
| 15 | `column-pinning-table` | Covered | Example 8 |
| 16 | `grouped-table` | Feature | F5 |
| 17 | `pivot-table` | Helper + recipe | F6 |
| 18 | `master-detail-table` | Covered | Examples 22, 23 |
| 19 | `editable-table` | Feature | F7 |
| 20 | `animated-icons-table` | Recipe (D8) | Built. Adds the `motion` package to `apps/admin` (the recipe's smart layer), not to the dumb component. The icons animate on hover and focus and stand still under reduced motion. Their Iconimate icon set is re-drawn with `motion` on Lucide icons; if a specific Iconimate icon has no Lucide match, the nearest one is used and the swap is listed in the progress log. |
| 21 | `async-actions-table` | Feature | F8 (without the animated icons) |
| 22 | `infinite-scroll-table` | Covered | Examples 19, 20 |
| 23 | `spreadsheet-table` | `Spreadsheet` + feature | Selection, clipboard and fill come from Part A. A1 headers and the formula engine are built here — section 7.6 |
| 24 | `live-status-table` | Recipe | Timer-driven data; verifies memoised rows still update |
| 25 | `kpi-table` | Recipe | Sparkline cell using our chart components |
| 26 | `comparison-table` | Recipe | Dynamic columns, highlighted column via `meta.cellClassName` |
| 27 | `heatmap-table` | Recipe | Pure `normalizeToScale` helper + cell renderer |
| 28 | `conditional-formatting-table` | Recipe | Small rule evaluator in the example's smart layer |
| 29 | `production-dashboard-table` | Recipe | Progress bars + trend cells |
| 30 | `crm-employees-table` | Recipe | Stacked cells |
| 31 | `crm-employees-multi-select-table` | Feature | F3 |
| 32 | `loading-state-table` | Covered | Example 15 |
| 33 | `empty-state-table` | Covered | Example 15 |
| 34 | `error-state-table` | Feature | F12 |
| 35 | `inventory-allocation-table` | Recipe | `editing` + `detail` + computed columns |
| 36 | `permissions-matrix-table` | Recipe | Candidate for the admin authorization pages |
| 37 | `csv-import-table` | Recipe | Parsing and mapping live in the smart layer; the table shows review state through `rowStatus` |
| 38 | `change-review-table` | Recipe | F4 + `rowStatus` |
| 39 | `job-queue-table` | Recipe | Live progress + `detail` |
| 40 | `schedule-matrix-table` | Recipe | Built on `Spreadsheet` (single-cell mode) |
| 41 | `draft-rows-table` | Feature | F16 |
| 42 | `file-browser-table` | Recipe | Breadcrumb in `toolbar.extra`, folders-first sort function |
| 43 | `split-detail-table` | Feature | F4 |
| 44 | `cohort-retention-table` | Recipe | Heatmap helper from #27 |
| 45 | `anomaly-investigation-table` | Recipe | Range-bar cell |
| 46 | `anomaly-investigation-finance-table` | Recipe | Same recipe, other data; not duplicated |
| 47 | `density-export-table` | Feature | F1, F14 |
| 48 | `export-config-table` | Feature | F13 |
| 49 | `export-selected-table` | Covered | Example 5 |
| 50 | `mobile-cards-table` | Covered + feature | Example 14; F15 |

Totals by bucket: 12 covered by Part A, 2 covered with a small added feature, 13 features, 2 feature or helper plus recipe, 20 recipes, 1 `Spreadsheet` plus formulas. Nothing is left out. The 16 features F1–F16 serve all the "feature" rows.

### 7.4 The loop for each feature

| Step | Work |
|---|---|
| 1 | Read their v9 files for the item. Write down the behaviour (keys, focus, edge cases), not the code. |
| 2 | Add the prop type to `internal/data-table/props.ts` with its JSDoc. |
| 3 | Put pure logic in `packages/ui-kit-logic/src/table/` with tests in `__tests__/`. |
| 4 | Implement in the engine or the shell. Base UI primitives only. Tokens only. Labels through `labels`. |
| 5 | Component tests: props → output, events → callbacks, keyboard, axe. |
| 6 | Add a showcase example and its `features.json` row; switch the feature on in the kitchen sink where it fits. |
| 7 | Update `docs.md`; tick the row in `enhancements.md`; log in `docs/history/PROGRESS-<date>.md`. |

### 7.5 Recipes

Recipes use only the public `DataTable` / `Spreadsheet`. They live in `examples/data-table/recipes/` and are listed in the gallery under a "Recipes" group. A recipe that needs something the public API cannot do is a signal to add a feature, not to reach into the engine.

All 20 recipes are built (D8), in this order so later ones reuse earlier helpers:

| Order | Recipe | Reuses |
|---|---|---|
| 1 | `heatmap` | new `normalizeToScale` helper |
| 2 | `cohort-retention` | heatmap helper |
| 3 | `conditional-formatting` | new rule evaluator |
| 4 | `production-dashboard` | conditional formatting, progress and trend cells |
| 5 | `kpi` | sparkline cell |
| 6 | `anomaly-investigation` (covers the finance variant with a second data set) | range-bar cell |
| 7 | `comparison` | dynamic columns |
| 8 | `crm-employees` | stacked cells, F3 |
| 9 | `deployments` | F3 |
| 10 | `logs` | F2, F3, F4 |
| 11 | `live-status` | timer data |
| 12 | `job-queue` | live progress, `detail` |
| 13 | `tree-variants` | `tree`, `selection` |
| 14 | `file-browser` | `toolbar.extra`, folders-first sort |
| 15 | `inventory-allocation` | `editing`, `detail`, F7 |
| 16 | `permissions-matrix` | checkbox cells |
| 17 | `change-review` | F4, `rowStatus` |
| 18 | `csv-import` | `rowStatus`, mapping selects in headers |
| 19 | `schedule-matrix` | `Spreadsheet` single-cell mode |
| 20 | `animated-icons` | `motion`, F8 |

### 7.6 Spreadsheet formulas and A1 headers (D9)

Built after the merge, as part of the ShadTable stage. Their `spreadsheet-table` item is the behaviour reference; step 1 of the feature loop records exactly which functions and error values it supports, and ours matches that list.

| Piece | Where | Detail |
|---|---|---|
| A1 addressing | `packages/ui-kit-logic/src/spreadsheet/address.ts` | Column index ↔ letters (`A`, `Z`, `AA`), cell reference parsing (`B2`), range parsing (`A1:C4`). Pure, tested. |
| Tokeniser and parser | `.../spreadsheet/formula-parser.ts` | Numbers, strings, cell references, ranges, operators (`+ - * / ^`, comparison, `&`), parentheses, function calls. Produces a typed tree. Input is validated with Zod at the edge; no `any`, no casts. |
| Evaluator | `.../spreadsheet/formula-evaluator.ts` | Walks the tree against a cell-value reader. Function registry (at least `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `IF`, `ROUND`, `ABS`, `CONCAT`, plus anything else their engine has). Error values: `#DIV/0!`, `#REF!`, `#NAME?`, `#VALUE!`, `#CYCLE!`. |
| Dependency graph | `.../spreadsheet/formula-graph.ts` | Which cells a formula reads; recalculates only what depends on a changed cell; detects cycles. |
| Component wiring | `packages/ui/src/internal/spreadsheet/` | `formulas` prop turns it on. A cell whose text starts with `=` is a formula: the cell shows the result, the editor shows the formula. Copy gives the result as text and the formula in the HTML clipboard part; fill adjusts relative references. |
| A1 headers | `packages/ui/src/internal/spreadsheet/` | `headers="a1"` draws column letters and row numbers, and shows the address of the focused cell. |
| Props added to `Spreadsheet` | `components/spreadsheet.tsx` | `formulas: { functions?, onError? }`, `headers: "columns" \| "a1"` |
| Tests | beside each file, in `__tests__/` | Parser and evaluator table tests, cycle detection, reference adjustment on fill, component tests for edit/display. |
| Ownership of data | unchanged | The caller still owns the cell values (formula text included). The component computes display values; it never writes data except through `onCellsChange`. |

---

## 8. Testing and verification

### 8.1 Test inventory

| Area | Location | Source |
|---|---|---|
| Engine | `packages/ui/src/internal/table-engine/__tests__/` | 9 moved `data-grid-*` test files |
| Spreadsheet | `packages/ui/src/internal/spreadsheet/__tests__/`, `packages/ui/src/components/__tests__/spreadsheet.test.tsx` | 3 moved cell-selection test files + new |
| Shell | `packages/ui/src/internal/data-table/__tests__/` | 3 moved `data-table-*` test files + new per feature |
| Public component | `packages/ui/src/components/__tests__/data-table.test.tsx` | New: one `describe` per prop group in section 4.2 |
| Pure logic | `packages/ui-kit-logic/src/table/__tests__/` | Moved + new |
| Showcase | `apps/admin/components/component-showcase/examples/data-table/__tests__/` | Each example renders without console errors |
| Pages | Existing tests in each admin context | Must stay green through phase 6 |
| Privacy | `packages/ui/src/__tests__/ui-kit-contract.test.ts` | New case: engine is unreachable from apps |

Rules that apply: tests in `__tests__/` beside the code; no skipped or weakened tests; coverage for every helper; behaviour tests are written before the code they protect is replaced.

### 8.2 Checks

| When | Command |
|---|---|
| After each step | Scoped: `pnpm --filter @workspace/ui lint`, `typecheck`, `test`; same for `@workspace/ui-kit-logic`, `@workspace/ui-native`, `admin`, `docs` and `mobile` when touched |
| End of Part C (this repo is finished) | Full gate from the repository root, once: `pnpm run format`, `lint`, `typecheck`, `test`, `test:e2e`, `ci:local`. Any failure is fixed at its root cause and the gate is rerun until green. |
| End of Part D, per repo | `nextjs-admin-dashboard-layout`: `pnpm format`, `lint`, `typecheck`, `test`, `test:e2e`. `expo-boilerplate`: `pnpm format`, `lint`, `typecheck`, `test`. Plus whatever each repo's own `AGENTS.md` lists as its completion gate. |
| Browser checks | The owner stops the dev servers before work starts (D16), so ports 8080/3000/3001 are free and the browser stage of `ci:local` runs. If the ports are still held, it is reported as NOT VERIFIED. |
| Mobile on a device | Component and logic tests only. No on-device check is made unless the owner asks; this is reported as NOT VERIFIED on device. |

---

## 9. Documentation updates

| Document | Change |
|---|---|
| `docs/adr/095-one-data-table.md` | New (phase 0.5) |
| `docs/architecture/data-table-unification-plan.md` | This file; appendices A and B filled in phase 0; status updated per phase |
| `rules/06-tanstack-state-forms-tables.md` | Lines 168–181: new prop shapes, filter contract per `source.mode` |
| `rules/24-golden-reference-implementations.md` | Line 293 onward: the dumb `DataTable` example |
| `rules/01-repository-architecture.md` | Lines 358–367: the internal-renderer example now matches the real `internal/` folder |
| `rules/03-web-nextjs.md` | Line 84 example re-checked |
| `packages/ui` README | What `DataTable` is for, what `Spreadsheet` is for, what neither is for |
| `docs/technical/api/list-queries.md` | Server query object naming |
| `docs/technical/tooling/oxlint.md` | New import-boundary pattern |
| `README.md` | Component list |
| `enhancements.md` | New rows for the unification and for F1–F16 |
| `docs/history/PROGRESS-<date>.md` | One entry per finished phase |
| Showcase `docs.md`, `overview.md`, `features.json`, `guidelines.json` | Rewritten for `DataTable` and `Spreadsheet` |

---

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A behaviour of the old `DataTable` is lost because no test described it | Medium | A real page regresses | Phase 0.1 inventory; behaviour tests written against the old component first and reused on the new one |
| The engine's row rendering is slower for the plain case than the old lean rows | Low–medium | List pages feel slower | Measure render time on a 100-row page before and after in phase 2; keep the subscribe-island pattern |
| Saved preferences from the old key are misread | Low | Columns appear hidden or misordered | New storage key version (`v2`), old entries ignored |
| Row drag moves from native drag to dnd-kit | Low | Different feel | It is an accessibility gain; noted in the ADR |
| The props redesign touches 19 pages in one programme | Medium | Large diff | One context per step, each independently green |
| Two contract sets live in `ui-kit-logic` between Part A and Part C | Certain, temporary | Confusion while both exist | The old folders are marked deprecated in their index file and deleted at the end of Part C |
| The whole programme is one sitting with no review | Certain | A wrong early choice is copied into four codebases | Phase 0 fixes the contract before code; every choice is logged with its reason; Part D starts only after this repo's full gate is green |
| The conversation context is summarised many times | Certain | A decision or a half-done step is forgotten | The progress log is updated after every step and re-read at the start of each phase |
| The two other repos have already drifted from this one (their `data-grid` tests and native components differ today) | Certain | "Same implementation" cannot be a blind copy | Part D ports the new files and then reconciles each repo's local differences deliberately, listing them in that repo's progress log |
| Formula engine scope creeps towards a full spreadsheet | Medium | Large unplanned work | The function list is fixed to what ShadTable's engine supports plus the nine named in 7.6 |
| `motion` is a new dependency | Low | Bundle size, 24-hour minimum-age rule on new packages | Added only to the app that hosts the recipe; a version old enough for the pnpm rule is chosen |
| Bundle size grows for simple pages | Low | Slower first load | Engine modules for dnd, virtualisation and resize are loaded only when their prop is set (dynamic import inside the shell); verified with the bundle report |

---

## 11. Questions — all answered

Answered by the owner on 2026-11-19. Nothing is open.

| # | Question | Answer |
|---|---|---|
| Q1 | Is the mobile kit in scope? | **Yes** (D6) — Part C |
| Q2 | Is the temporary name `UnifiedTable` acceptable? | **Yes**, as long as it is temporary (D2) |
| Q3 | Drop the per-part class-name overrides? | **Yes** (D7) |
| Q4 | How much of ShadTable? | **Everything**: F1–F16, all recipes, animated icons with `motion` (D8) |
| Q5 | Spreadsheet formulas and A1 headers? | **Build them**, during the ShadTable stage (D9) |
| Q6 | Mobile parity? | Phone-shaped form wherever one exists; print view is web only (D10) |
| Q7 | Subagents? | **No** (D11) |
| Q8 | Review stops? | **None**; review happens once at the end (D12, D13) |
| Q9 | Existing uncommitted work in this repo? | The owner pushes it first, then gives the start signal (D17) |
| Q10 | Private engine in the single-app repo? | `internal/` folder plus a lint rule (D15) |
| Q11 | Ports and device checks? | The owner stops the dev servers before work starts (D16) |
| Q12 | Other repos? | Same implementation in `nextjs-admin-dashboard-layout` and `expo-boilerplate` afterwards (D14) — Part D |

One assumption to flag: the answer to "all recipes, and the animated-icons example?" was "Build it". This plan reads that as **both** — all recipes and the animated-icons example. If only the animated-icons example was meant, section 7.5 shrinks.

The merchant app has no table pages today, so there is nothing to migrate there; it simply gets the new `DataTable` when it needs one.

---

## 12. Things this plan has not verified

| Item | Status | Resolved in |
|---|---|---|
| Line-by-line behaviour of the 23 `data-grid/` files | Read at the level of exports, props, layout schema and file headers only | Phase 0.1 |
| Which props each of the 19 pages uses | Not read page by page | Phase 0.2 |
| Whether the engine's overlay editor works without cell selection being on | Assumed from the `meta.cellEdit.control` comment; not tested | Phase 0.3; if not, phase 4.1 ports the simple inline input onto the engine cell instead |
| Whether the engine's sub-row selection already cascades | Not checked | Phase 0.3 (affects F10) |
| Render cost of the engine against the old rows | Not measured | Phase 2 |
| ShadTable behaviour details | Read from their v9 registry files for 16 items; not run locally | Step 1 of each feature loop |
| Effort | No estimate given; the plan fixes order and exit criteria, not dates | Estimated after phase 0 |
| The mobile kit's two components | Read at the level of file headers, exports and prop names only | Phase C0 |
| The two other repos | Checked on 2026-11-19 only for: location, clean working tree, which table files exist, TanStack Table version, scripts, and that their copies already differ from this repo's | Phases D1.0 and D2.0 |
| Which formula functions ShadTable's engine supports | Not read yet | Step 1 of section 7.6 |

---

## 13. Part C — mobile kit

### 13.1 What exists

| | `DataTable` (native) | `DataGrid` (native) |
|---|---|---|
| Files | `packages/ui-native/src/components/data-table.tsx` (1,372 lines), `data-table-card.tsx`, `lib/data-table.ts` (192) | `components/data-grid.tsx` (1,222), `data-grid-parts.tsx` (553), `lib/data-grid.ts` (505) |
| API style | One component, flat props, its own small column shape (`DataTableColumn`) | Provider plus parts; the screen owns `useTable` — the same split as the web |
| Shared with web | Copy, preferences, column ids, selection config, export documents, pagination modes, clipboard parsing — all from `@workspace/ui-kit-logic` | |
| Showcase | `apps/mobile/src/features/showcase/examples/data-table/` and `.../data-grid/` (about 70 files) plus generated code | |
| Real screens | None found outside the showcase (to be confirmed in C0) | |

### 13.2 Target

The same three layers as the web, in the mobile kit's own folders:

| Layer | Path |
|---|---|
| Public | `packages/ui-native/src/components/data-table.tsx`, `spreadsheet.tsx` |
| Private shell | `packages/ui-native/src/internal/data-table/` |
| Private spreadsheet parts | `packages/ui-native/src/internal/spreadsheet/` |
| Private engine | `packages/ui-native/src/internal/table-engine/` |
| Shared logic | `packages/ui-kit-logic/src/table/`, `.../spreadsheet/` — the **same** files the web uses |

The public prop names and shapes are the **same as the web's** (section 4), so a developer who knows one knows the other. Where a platform differs, the prop keeps its name and the platform decides the form. The pure logic (filters, pivot, edit history, formulas, export text, preferences, pagination maths) is written once in `ui-kit-logic` and used by both.

### 13.3 Feature form on a phone (D10)

| Feature | Web form | Phone form |
|---|---|---|
| Heading, search, sorting, paging, status, empty state | Same | Same, native controls |
| Filters: select, multi-select, date-range | Popovers | The kit's menus and bottom sheets; date range uses the native kit's calendar |
| Row actions | ⋯ menu | ⋯ button opening the kit's menu (as today) |
| Selection and bulk bar | Bar above the table | Bar above the list; long-press starts selection |
| Export, export dialog (F13) | Download; dialog | Share sheet through the existing `DataTableExporter`; the dialog is a bottom sheet |
| Column visibility, pinning | Header menu | Columns menu; pinned columns stay at the start while the table scrolls sideways (as today) |
| Column resizing, reordering | Mouse, touch, keyboard | Finger drag on the header, with screen-reader actions (the native grid has this today) |
| Row reorder | dnd-kit | Drag handle plus move actions (as today) |
| Inline edit, validation, undo (F7) | Overlay editor | Native text input over the cell; undo control in the toolbar |
| Tree rows, cascading selection (F9–F11) | Indent + chevron | Same |
| Detail row | Expanded row | Same |
| **Detail panel (F4)** | Side panel, ↑/↓ | **Bottom sheet**; swipe or next/previous buttons move between rows |
| Grouping (F5) | Group header rows | Same, collapsible sections |
| Pivot (F6) | Helper + recipe | Same helper; the recipe scrolls sideways |
| Footer totals | Footer rows | Same |
| Infinite source | Scroll | List end-reached |
| Virtualisation | `@tanstack/react-virtual` | The native list's own windowing (as today) |
| Density (F1) | Three levels | Three levels |
| Mobile cards (F15) | Container query | `renderCard` (as today) — the card view is the default suggestion on a phone |
| Draft rows (F16), row status | Same | Same |
| Row action state (F8), error banner (F12) | Same | Same |
| Saved preferences | Local storage adapter | The app's storage adapter through the same contract |
| **Print view (F14)** | Print styles | **Web only** |
| `Spreadsheet`: ranges, copy/paste, fill | Mouse and keyboard | Tap picks a cell, long press stretches a block, a bar offers copy, paste, fill, clear, edit (as the native grid does today) |
| `Spreadsheet`: formulas and A1 headers | Section 7.6 | Same engine from `ui-kit-logic`; formula typed in the cell editor |

### 13.4 Phases

| Phase | Work | Exit |
|---|---|---|
| C0 | Read both native components and `lib/` files fully. Inventory behaviours, gestures, accessibility actions. Confirm there are no real screens. Record in the progress log. | Inventory written |
| C1 | Create `internal/table-engine/` from `data-grid.tsx`, `data-grid-parts.tsx` and `lib/data-grid.ts` (copy first, old files keep working). One feature bundle, matching the web's. | Engine tests green |
| C2 | Build the temporary `UnifiedTable` (native) with the new props, on the engine, with the shell from the old native `DataTable`. Switch every import from `ui-kit-logic/data-table` and `/data-grid` to `ui-kit-logic/table`. | Old native `DataTable` features all present |
| C3 | Expose the grid-only features as props (tree, detail, pinning, footer, infinite, resize, reorder). | Old native `DataGrid` features all present |
| C4 | Build native `Spreadsheet` from the grid's cell-selection parts. | Tests green |
| C5 | Add F1–F13, F15, F16 in their phone forms, then formulas and A1 headers. Mind the mobile rules already learned: named-group regex only through `exec` on fresh literals; skip Reanimated `entering` under Reduce Motion. | Each has tests |
| C6 | Rebuild the mobile showcase: the same example list as the web (minus print), plus the recipes that make sense on a phone. Regenerate its generated code. | Showcase runs |
| C7 | Delete the old native files and their tests; rename `UnifiedTable` → `DataTable`. Delete `packages/ui-kit-logic/src/data-table/` and `data-grid/`. Delete the old label families. Update `docs/adr/053-react-native-ui-kit.md` and the native kit README. | Nothing imports the old names |
| C8 | **Full gate for this repo** (section 8.2). | Green |

Recipes on mobile: every recipe is ported where its layout survives a phone width. Any that does not (candidates: `schedule-matrix`, `permissions-matrix` with many columns) is still built, scrolling sideways, rather than dropped; if one truly cannot work it is listed in the progress log with the reason.

---

## 14. Part D — the two other repos

D1 (the web repo) starts after Parts A and B pass their scoped checks here; D2 (the mobile repo) starts after Part C and this repo's full gate. The order is in section 15. The rule is **the same implementation**: same file names, same folder layout inside the kit, same props, same tests. Only import paths differ.

### 14.1 `nextjs-admin-dashboard-layout` (web)

| Fact (checked 2026-11-19) | Detail |
|---|---|
| Location | `/Users/patel/Desktop/Bishen/NextJS/nextjs-admin-dashboard-layout` |
| Shape | Single Next.js 16 app, React 19, Base UI, TanStack Table `9.3.1`, Vitest, Playwright |
| Old files | `components/ui/data-table*.tsx` (5 files), `components/ui/data-grid/` (same 22 files as here), `testing/data-grid-test-harness.tsx`, `components/common/data-table-search-toolbar.tsx`, `lib/data-table/` |
| Showcase | `features/showcase/examples/data-table/`, `.../data-grid/`, `features/showcase/generated/` |
| Drift | Its `data-grid` tests already differ from this repo's, and one test file exists only here |
| Working tree | Clean |

| Path in this repo | Path there |
|---|---|
| `packages/ui/src/components/data-table.tsx`, `spreadsheet.tsx` | `components/ui/data-table.tsx`, `spreadsheet.tsx` |
| `packages/ui/src/internal/{table-engine,data-table,spreadsheet}/` | `components/ui/internal/{table-engine,data-table,spreadsheet}/` |
| `packages/ui/src/lib/table/` | `lib/table/` |
| `packages/ui-kit-logic/src/{table,spreadsheet}/` | `lib/table/logic/`, `lib/spreadsheet/logic/` (confirmed in D1.0 against where that repo keeps its copy of the shared logic today) |
| Showcase examples and recipes | `features/showcase/examples/data-table/`, `.../spreadsheet/` |

| Phase | Work |
|---|---|
| D1.0 | Read that repo's `AGENTS.md` and rules. Find every consumer of the old components (pages, `data-table-search-toolbar.tsx`, `lib/data-table/`). Map where the shared logic and labels live. Diff its old components against this repo's old ones and list local differences worth keeping. |
| D1.1 | Bring over the logic, engine, shell, spreadsheet, tests and labels. |
| D1.2 | Private engine (D15): `components/ui/internal/` plus a lint rule in its `oxlint.config.ts` that forbids importing `components/ui/internal/` from anywhere outside `components/ui/`. A test asserts it. |
| D1.3 | Migrate its real pages and helpers to the new props. |
| D1.4 | Rebuild its showcase and regenerate. Add the `motion` dependency for the animated-icons recipe. |
| D1.5 | Delete its old files with `git rm`. |
| D1.6 | Update its docs and write `docs/history/PROGRESS-<date>.md` there. Run its gate. |

### 14.2 `expo-boilerplate` (mobile)

| Fact (checked 2026-11-19) | Detail |
|---|---|
| Location | `/Users/patel/Desktop/Bishen/react-native/expo-boilerplate` |
| Shape | Single Expo SDK 58 app, TanStack Table `^9.3.1`, Jest |
| Old files | `src/ui/components/data-table.tsx`, `data-table-card.tsx`, `data-grid.tsx`, `data-grid-parts.tsx`, `src/ui/lib/data-table.ts`, `data-grid.ts` |
| Showcase | `src/features/showcase/examples/data-table/`, `.../data-grid/`, `src/features/showcase/generated/` |
| Drift | Its `data-table.tsx` and `data-grid.tsx` already differ from `packages/ui-native`'s |
| Working tree | Clean |

| Path in this repo | Path there |
|---|---|
| `packages/ui-native/src/components/data-table.tsx`, `spreadsheet.tsx` | `src/ui/components/data-table.tsx`, `spreadsheet.tsx` |
| `packages/ui-native/src/internal/…` | `src/ui/internal/…` |
| `packages/ui-kit-logic/src/{table,spreadsheet}/` | Wherever that repo keeps the shared logic today (found in D2.0) |
| `apps/mobile/src/features/showcase/…` | `src/features/showcase/…` |

| Phase | Work |
|---|---|
| D2.0 | Read its `AGENTS.md` and rules. Find consumers. Locate its copy of the shared logic. Diff its old native components against this repo's old ones and list the differences. Its tests run on Jest, not Vitest: note what that changes in the test files. |
| D2.1 | Bring over logic, engine, shell, spreadsheet, tests, labels. The component code must be **identical** to `packages/ui-native`'s apart from import paths. |
| D2.2 | Private engine: `src/ui/internal/` plus a lint rule in its `oxlint.config.mts`. |
| D2.3 | Migrate any real screens. Rebuild its showcase and regenerate. |
| D2.4 | Delete its old files with `git rm`. |
| D2.5 | Update its docs and write its progress log. Run its gate. If a dependency must be added, respect what the Expo SDK pins. |

If either repo turns out to need a change in the shared implementation, the change is made **in this repo first**, then carried to both, so the three never drift.

---

## 15. Order of the whole sitting

The owner set the main course on 2026-11-19: (1) combine `data-grid` and `data-table`, (2) ShadTable on the combined table, (3) the same in `nextjs-admin-dashboard-layout`; the web consistency sweep (Part E) comes only after those three.

| # | Part | Phases | Ends with |
|---|---|---|---|
| 1 | A — web merge | 0 → 7 | Old web components deleted; `DataTable` and `Spreadsheet` live; 19 pages migrated |
| 2 | B — web ShadTable | F1 → F16, formulas, 20 recipes | Every ShadTable pattern available; scoped checks green for `@workspace/ui`, `@workspace/ui-kit-logic`, `admin`, `docs` |
| 3 | D1 — `nextjs-admin-dashboard-layout` | D1.0 → D1.6 | That repo's gate green |
| 4 | C — mobile kit | C0 → C8 | Old native components and old shared logic deleted; **this repo's full gate green** |
| 5 | D2 — `expo-boilerplate` | D2.0 → D2.5 | That repo's gate green |
| 6 | E — web consistency sweep | E0 → E5 | Every low-level web component and every showcase example is identical in both web repos apart from imports; both gates green again |
| 7 | Final report | — | One end-of-task report per repo: summary, files changed, decisions and reasons, checks with exact commands and results or NOT VERIFIED, documentation updates, shortcuts (none expected), remaining risks, and a plain-English explanation |

Two notes on this order:

- The mobile parts (C, D2) sit between step 3 and the sweep. The owner's three-point list names only the web steps; mobile was approved earlier (D6) but its position was not stated. It is placed here so the web course runs first, uninterrupted. If mobile should instead run after Part E, or be left for a later sitting, only this table changes.
- Because D1 now runs before Part C, the old `ui-kit-logic` folders still exist in this repo while D1 is done. D1 ports only the **new** logic (`table/`, `spreadsheet/`), so nothing old is carried over. If Part C later forces a change to the shared logic, that change is made here first and then carried to `nextjs-admin-dashboard-layout` before Part E starts.

Rules that hold throughout: source edits only through the editor tools; no `rm -rf` (deletions are `git rm` on named paths); no commits or pushes; no database migrations or seeds run by the implementer; no dependency patches; no lint suppressions; `tsrs` for typechecks; tests in `__tests__/` beside the code.

**Start condition:** an explicit go from the owner, after the other thread's work has been pushed and the dev servers are stopped. Until then, no source file is changed.

---

## 16. Part E — web consistency sweep (done last)

### 16.1 Goal

**The whole low-level web kit** — every component, not only the tables — and every showcase example of it, has **the same code** in `nestjs-nextjs-turborepo-starter-kit` and `nextjs-admin-dashboard-layout`. The only allowed difference in a file is its import lines (and, where unavoidable, the things listed in 16.4). The owner confirmed this scope on 2026-11-19.

The sweep is web only. The mobile pair (`packages/ui-native` ↔ `expo-boilerplate`) was made identical in an earlier piece of work; section 16.8 records a fresh check of it.

### 16.2 The drift today

Measured on 2026-11-19, before any of this work, by comparing each pair of files with their import lines removed.

| Set | Starter kit | Dashboard layout | Same after ignoring imports | Different |
|---|---|---|---|---|
| Low-level components (`.ts` / `.tsx`, tests excluded) | 262 in `packages/ui/src/components/` | 262 in `components/ui/` | 218 | **44** |
| Showcase example files | 1,764 in `apps/admin/components/component-showcase/examples/` | 1,763 in `features/showcase/examples/` | 1,716 | **47**, plus 1 file that exists only in the starter kit |
| Component families | Same list in both | Same list in both | — | none missing on either side |

These counts will be lower when Part E starts, because Parts A, B and D1 replace the table and grid files on both sides with identical code. Not yet measured: component tests, `lib/` helpers, hooks, label files, tokens and styles, and the showcase generator scripts. E0 measures them.

### 16.3 Path mapping

| Starter kit | Dashboard layout |
|---|---|
| `packages/ui/src/components/` | `components/ui/` |
| `packages/ui/src/components/**/__tests__/` | `components/ui/**/__tests__/` |
| `packages/ui/src/internal/` | `components/ui/internal/` |
| `packages/ui/src/lib/`, `packages/ui/src/hooks/` | `lib/…`, `hooks/…` (exact mapping confirmed in E0) |
| `packages/ui-kit-logic/src/` | That repo's copy of the shared logic (found in D1.0) |
| `packages/ui/src/lib/labels/messages/*.json` | That repo's label files |
| `apps/admin/components/component-showcase/examples/` | `features/showcase/examples/` |
| `apps/admin/components/component-showcase/generated/` | `features/showcase/generated/` (regenerated, never hand-edited) |
| `apps/admin/scripts/showcase-*.ts` | That repo's showcase generator scripts |

### 16.4 What may differ, and nothing else

| Allowed difference | Example |
|---|---|
| Import specifiers | `@workspace/ui/components/button` ↔ `@/components/ui/button` |
| The import-order result of each repo's formatter | Line order inside the import block |
| A path inside a comment that names the file's own location | `// packages/ui/src/components/x.tsx` ↔ `// components/ui/x.tsx` |
| Generated files | They must be the output of the same generator on identical inputs |

Anything else that differs is a defect to reconcile. A difference that a repo genuinely needs (for example a monorepo-only concern) is not kept as a silent fork: it is either moved out of the low-level component into that repo's smart layer, or made a prop, so the component stays identical.

### 16.5 How each difference is settled

| Case | Rule |
|---|---|
| One side has a bug fix, an accessibility fix or a newer feature the other lacks | The better version wins and is carried to the other side |
| Both sides changed the same component in different ways | Merge by hand into one version that has both improvements; record it |
| The difference is only naming, comments or ordering | The starter kit's version wins (it is the foundation other products are built from) |
| It is unclear which side is right | The behaviour is checked against that component's tests and showcase on both sides; the choice and the reason go in the log. Nothing is guessed silently. |
| A file exists on one side only | It is added to the other side, unless it is dead code, in which case it is removed from both |

Every reconciled file is listed in `docs/history/PROGRESS-<date>-web-consistency.md` (in both repos) with: the file, which side won or that it was merged, and one line of why.

### 16.6 Phases

| Phase | Work | Exit |
|---|---|---|
| E0 | Write a comparison script, `scripts/compare-web-kit.ts`, kept in the starter kit. It takes the path of the other repo, applies the path mapping in 16.3, strips the allowed differences in 16.4, and prints every file that still differs or exists on one side only. Run it over components, tests, lib, hooks, labels, showcase examples and generator scripts. Save the first report in the progress log. | Full drift list |
| E1 | Low-level components: settle each differing file by the rules in 16.5, with its tests. Work family by family; after each family run that family's tests in **both** repos. | Script reports no component or component-test differences |
| E2 | Supporting code the components rely on: `lib/`, hooks, shared logic, label keys and all four language files, tokens and styles. | Script reports none |
| E3 | Showcase: example files, per-component `docs.md`, `overview.md`, `features.json`, `guidelines.json`, and the generator scripts. Then regenerate the generated folder in both repos and compare the outputs. | Script reports none; generated output matches |
| E4 | Keep it from drifting again: document the script in both repos' docs (how to run it, what it allows), and add the rule "a change to a low-level web component is made in both repos, and the comparison script must report nothing" to both repos' agent instructions. | Docs updated |
| E5 | Run the starter kit's full gate again and the dashboard layout's gate again. | Both green |

### 16.7 Limits

| Limit | Detail |
|---|---|
| Not a rewrite | The sweep makes the two sides equal. It does not redesign components that are already identical. |
| Smart layers are out of scope | Pages, contexts, feature folders and app shells differ between the two products on purpose and are not compared. |
| The script cannot live in CI | Each repo's CI cannot see the other repo. The script is run locally with the other repo's path. Whether to share the kit as a published package instead — which would remove the need for two copies — is a separate decision and is not part of this plan. |
| Third repo | `expo-boilerplate` is covered by Part D2's "identical apart from imports" rule, not by this sweep. |

### 16.8 Mobile double-check (done 2026-11-19, read-only)

The owner believed the mobile kits were already identical and asked for a check.

| Compared | Files | Result |
|---|---|---|
| `packages/ui-native/src/components/` ↔ `expo-boilerplate/src/ui/components/` | 128 on each side, same names | **No difference in code found** |
| `packages/ui-native/src/lib/` ↔ `expo-boilerplate/src/ui/lib/` | 36 on each side, same names | **No difference in code found** |
| Mobile showcase examples | 1,762 on each side, same names | Not fully checked — see below |

How it was checked: copies of both sides were formatted with one formatter configuration in a scratch folder, import lines were removed, then whitespace, trailing commas and the order of class names inside strings were ignored. After that, 116 of 128 components and 35 of 36 lib files were equal outright. The remaining 13 files were opened; in the 5 sampled, every difference was layout only (an object written on one line on one side and on several lines on the other). The other 8 were not read line by line.

Why the files are **not** byte-identical today, even though the code is the same:

| Setting | Starter kit (`.oxfmtrc.json`) | `expo-boilerplate` (`.oxfmtrc.json`) |
|---|---|---|
| Indent | Tabs | Spaces |
| Line width | 175 | 120 |
| Order of Tailwind classes in a string | One order | A different order (for example `bg-primary active:…` vs `active:… bg-primary`) |

So the mobile code has not drifted, but the two repos format it differently. `nextjs-admin-dashboard-layout` uses the same formatter settings as the starter kit (tabs, 175), so the web sweep does not have this problem.

Consequences for this plan:

| Item | Effect |
|---|---|
| Part D2 | Once the formatter is aligned (16.9), "identical apart from imports" for mobile means byte-identical. |
| The comparison script (E0) | Formats both sides with one configuration in memory before comparing, so it can also be pointed at the mobile pair. |
| Mobile showcase | A quick comparison left 683 of 1,762 example files unequal, but that comparison did not neutralise formatting, so the number proves nothing. D2.0 runs the proper comparison on the showcase and on the 8 unread component files before porting. |
| Decision (owner, 2026-11-19) | **`expo-boilerplate` adopts the starter kit's formatter settings**, so the mobile files become identical byte for byte. Section 16.9 has the steps. |

### 16.9 Aligning the mobile formatter (D20)

The two configuration files, read on 2026-11-19:

| Setting | Starter kit | `expo-boilerplate` today | After alignment |
|---|---|---|---|
| `useTabs` | `true` | not set (spaces) | `true` |
| `printWidth` | 175 | 120 | 175 |
| `trailingComma` | `all` | `es5` | `all` |
| `semi`, `bracketSpacing`, `jsxSingleQuote`, `endOfLine`, `sortPackageJson` | set explicitly | not set (defaults) | set to the starter kit's values |
| `tabWidth`, `singleQuote`, `bracketSameLine` | 2, `false`, `true` | same | unchanged |
| `sortTailwindcss.functions` | `cn`, `cva` | `cn`, `cva` | unchanged |
| `sortTailwindcss.stylesheet` | `packages/ui/src/styles/globals.css` (the **web** stylesheet) | `./global.css` (the mobile stylesheet) | see below |
| `sortTailwindcss.attributes` | not set | `contentContainerClassName`, `colorClassName`, `placeholderTextColorClassName`, `textClass` | see below |
| `ignorePatterns` | monorepo paths | that repo's own paths | stays that repo's own (paths differ by nature) |

**The class-order problem.** Indent, width and commas are a plain copy. The order of Tailwind classes is not: the formatter sorts classes against a stylesheet, and the starter kit sorts its **mobile** code against the **web** stylesheet. That stylesheet does not know the mobile tokens (`rounded-button`, `text-caption`, `font-sans-semibold`), so it treats them as unknown and puts them first — which is exactly the difference seen in 16.8. `expo-boilerplate` sorts against its real mobile stylesheet and also sorts four mobile-only class attributes, so its order is the correct one.

Making `expo-boilerplate` copy the starter kit's class order would mean sorting mobile code against a stylesheet that does not describe it. The fix at the right layer is the other way round for this one setting:

| Step | Repo | Work |
|---|---|---|
| 1 | Starter kit | Add a formatter override for `packages/ui-native/**` and `apps/mobile/**` that points `sortTailwindcss.stylesheet` at the mobile stylesheet and adds the four mobile class attributes. Confirm first that the formatter supports per-path overrides in the installed version; if it does not, give those two workspaces their own `.oxfmtrc.json`. |
| 2 | Starter kit | Run the formatter on those two workspaces only. Result: mobile class order in the starter kit now matches `expo-boilerplate`'s. This is a formatting-only diff; tests and typecheck are rerun to prove nothing else moved. |
| 3 | `expo-boilerplate` | Change `.oxfmtrc.json` to the starter kit's values for every other setting (tabs, 175, `trailingComma: all`, and the explicit defaults). |
| 4 | `expo-boilerplate` | Run the formatter over the whole repo once. This is one large formatting-only diff; lint, typecheck and tests are rerun. |
| 5 | Both | Run the comparison script over the mobile pair. Expected: every component, lib and showcase file is byte-identical apart from import lines. Anything left is real drift and is settled by the rules in 16.5. |

If step 1 shows the two mobile stylesheets themselves differ (different tokens), that is a real drift in the design tokens, not a formatting matter; it is recorded and reconciled before step 2.

Where it sits in the order: with Part D2, **before** the table work is ported to `expo-boilerplate` (so the port lands already in the final format), and step 1–2 run at the start of Part C for the same reason. The formatting change is kept apart from the table changes in the progress log so the owner can review the two separately; because the implementer does not commit, the owner may want to commit the formatting diff on its own first — the log will say exactly which files are formatting-only.

---

## Appendix A — Behaviour inventory

To be filled in phase 0.1.

## Appendix B — Page × prop usage

To be filled in phase 0.2.
