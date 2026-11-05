"use client";

// The data grid table's fill column (enhancement 8.1: split from data-grid-table.tsx): the spare width after the last column, in head, body and foot.

import { useDataGrid } from "@workspace/ui/components/data-grid/data-grid";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import { FILL_WIDTH_COLLAPSED_STYLE, FILL_WIDTH_STYLE } from "./data-grid-table-layout";
import { HAS_FILL_COLUMN_VISITOR } from "./data-grid-table-resize";

/** The width style the filler strip cells and col share. */
export function useDataGridFillStyle(): React.CSSProperties {
	return useDataGrid().withGrid(HAS_FILL_COLUMN_VISITOR) ? FILL_WIDTH_COLLAPSED_STYLE : FILL_WIDTH_STYLE;
}

// ── Filler strip ───────────────────────────────────────────────────────────

export function DataGridTableFillCol(): React.JSX.Element | null {
	const { props } = useDataGrid();
	const style = useDataGridFillStyle();
	if (!props.tableLayout.columnsResizable) {
		return null;
	}
	return <col data-slot="data-grid-table-fill-col" style={style} />;
}

export interface DataGridTableFillHeadCellProps extends Omit<React.ComponentProps<"th">, "children" | "style"> {
	/** Multi-level headers render one fill cell spanning every head row. */
	readonly rowSpan?: number;
}

/** The filler strip's head cell (rendered only under `columnsResizable`). */
export const DataGridTableFillHeadCell = React.forwardRef<HTMLTableCellElement, DataGridTableFillHeadCellProps>(function DataGridTableFillHeadCell(
	{ rowSpan, className, ...props },
	ref,
): React.JSX.Element | null {
	const { props: gridProps } = useDataGrid();
	const style = useDataGridFillStyle();
	if (!gridProps.tableLayout.columnsResizable) {
		return null;
	}
	return (
		<th
			ref={ref}
			aria-hidden="true"
			data-slot="data-grid-table-fill-head-cell"
			rowSpan={rowSpan !== undefined && rowSpan > 1 ? rowSpan : undefined}
			style={style}
			className={cn("p-0", gridProps.tableLayout.headerBackground ? "bg-muted" : undefined, className)}
			{...props}
		/>
	);
});

/** The filler strip's body cell (rendered only under `columnsResizable`). */
export const DataGridTableFillBodyCell = React.forwardRef<HTMLTableCellElement, Omit<React.ComponentProps<"td">, "children" | "style">>(function DataGridTableFillBodyCell(
	{ className, ...props },
	ref,
): React.JSX.Element | null {
	const { props: gridProps } = useDataGrid();
	const style = useDataGridFillStyle();
	if (!gridProps.tableLayout.columnsResizable) {
		return null;
	}
	return <td ref={ref} aria-hidden="true" data-slot="data-grid-table-fill-body-cell" style={style} className={cn("p-0", className)} {...props} />;
});

export function DataGridTableFillFootCell(): React.JSX.Element | null {
	const { props } = useDataGrid();
	const style = useDataGridFillStyle();
	if (!props.tableLayout.columnsResizable) {
		return null;
	}
	return <td aria-hidden="true" data-slot="data-grid-table-fill-foot-cell" style={style} className="p-0" />;
}

// ── Add row ────────────────────────────────────────────────────────────────
