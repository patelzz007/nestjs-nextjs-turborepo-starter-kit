/**
 * Every user-facing string the data grid renders or announces — the `dataGrid`
 * family of `UiKitLabels`. The kit ships no copy of its own: an app supplies the
 * family through `UiKitLabelsProvider` (the English pack lives in
 * `lib/labels/en.ts`), and one grid overrides individual strings with its
 * `labels` prop (`<DataGrid labels={GRID_LABELS}>`, a module constant).
 *
 * Anything interpolated is a function, so pluralization and word order live in
 * the label, never in string concatenation at a call site.
 *
 * Precedence, most specific wins: a component-level copy prop
 * (`rowCreateLabel`, `loadingMessage`, `emptyMessage`, the pagination label
 * props) beats the grid's `labels` override, which beats the provider's pack.
 */
import type { DataGridLabels } from "@workspace/ui-kit-logic";

export type { DataGridLabels, DataGridPaginationInfo } from "@workspace/ui-kit-logic";

/** A per-grid override of some of the family's strings. */
export type DataGridLabelsOverride = Partial<DataGridLabels>;
