"use client";

// The data grid table's fill column (enhancement 8.1: split from table-engine-table.tsx): the spare width after the last column, in head, body and foot.

import { useTableEngine } from "./table-engine";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import { FILL_WIDTH_COLLAPSED_STYLE, FILL_WIDTH_STYLE } from "./table-engine-table-layout";
import { HAS_FILL_COLUMN_VISITOR } from "./table-engine-table-resize";

/** The width style the filler strip cells and col share. */
export function useTableEngineFillStyle(): React.CSSProperties {
	return useTableEngine().withGrid(HAS_FILL_COLUMN_VISITOR) ? FILL_WIDTH_COLLAPSED_STYLE : FILL_WIDTH_STYLE;
}

// ── Filler strip ───────────────────────────────────────────────────────────

export function TableEngineTableFillCol(): React.JSX.Element | null {
	const { props } = useTableEngine();
	const style = useTableEngineFillStyle();
	if (!props.tableLayout.columnsResizable) {
		return null;
	}
	return <col data-slot="table-engine-table-fill-col" style={style} />;
}

export interface TableEngineTableFillHeadCellProps extends Omit<React.ComponentProps<"th">, "children" | "style"> {
	/** Multi-level headers render one fill cell spanning every head row. */
	readonly rowSpan?: number;
}

/** The filler strip's head cell (rendered only under `columnsResizable`). */
export const TableEngineTableFillHeadCell = React.forwardRef<HTMLTableCellElement, TableEngineTableFillHeadCellProps>(function TableEngineTableFillHeadCell(
	{ rowSpan, className, ...props },
	ref,
): React.JSX.Element | null {
	const { props: gridProps } = useTableEngine();
	const style = useTableEngineFillStyle();
	if (!gridProps.tableLayout.columnsResizable) {
		return null;
	}
	return (
		<th
			ref={ref}
			aria-hidden="true"
			data-slot="table-engine-table-fill-head-cell"
			rowSpan={rowSpan !== undefined && rowSpan > 1 ? rowSpan : undefined}
			style={style}
			className={cn("p-0", gridProps.tableLayout.headerBackground ? "bg-muted" : undefined, className)}
			{...props}
		/>
	);
});

/** The filler strip's body cell (rendered only under `columnsResizable`). */
export const TableEngineTableFillBodyCell = React.forwardRef<HTMLTableCellElement, Omit<React.ComponentProps<"td">, "children" | "style">>(
	function TableEngineTableFillBodyCell({ className, ...props }, ref): React.JSX.Element | null {
		const { props: gridProps } = useTableEngine();
		const style = useTableEngineFillStyle();
		if (!gridProps.tableLayout.columnsResizable) {
			return null;
		}
		return <td ref={ref} aria-hidden="true" data-slot="table-engine-table-fill-body-cell" style={style} className={cn("p-0", className)} {...props} />;
	},
);

export function TableEngineTableFillFootCell(): React.JSX.Element | null {
	const { props } = useTableEngine();
	const style = useTableEngineFillStyle();
	if (!props.tableLayout.columnsResizable) {
		return null;
	}
	return <td aria-hidden="true" data-slot="table-engine-table-fill-foot-cell" style={style} className="p-0" />;
}

// ── Add row ────────────────────────────────────────────────────────────────
