"use client";

// One row drawn as a card, for narrow screens: the caller's card, a selection checkbox beside it when rows can be
// selected, and the row's own click.

import type { RowData } from "@tanstack/react-table";
import * as React from "react";

import { TableEngineTableRowSelect } from "../table-engine/table-engine-table";
import type { TableEngineRow } from "../table-engine/table-engine-table-layout";
import type { DataTableMobileCardRenderer, DataTableRowAction, DataTableRowHandler } from "./props";
import { availableRowActions } from "./row-actions-menu";
import { memoGeneric } from "./shared";

export interface MobileCardViewProps<TData extends RowData> {
	readonly row: TableEngineRow<TData>;
	readonly isSelectable: boolean;
	readonly mobileCard: DataTableMobileCardRenderer<TData>;
	readonly rowActions: readonly DataTableRowAction<TData>[];
	readonly onRowClick?: DataTableRowHandler<TData> | undefined;
}

export const MobileCardView = memoGeneric(function MobileCardView<TData extends RowData>({
	row,
	isSelectable,
	mobileCard,
	rowActions,
	onRowClick,
}: MobileCardViewProps<TData>): React.JSX.Element {
	const rowData = row.original;

	const handleClick = React.useCallback((): void => {
		void onRowClick?.(rowData);
	}, [onRowClick, rowData]);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			// Only the card itself activates: a button inside it keeps its own Enter and Space.
			if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) {
				return;
			}
			event.preventDefault();
			void onRowClick?.(rowData);
		},
		[onRowClick, rowData],
	);

	// The card gets only the actions this row offers, the same ones its table row would show.
	const card = mobileCard(rowData, availableRowActions(rowActions, rowData));

	return (
		<div data-slot="data-table-mobile-card" className="flex items-start gap-3">
			{isSelectable ? (
				<div className="pt-4">
					<TableEngineTableRowSelect row={row} />
				</div>
			) : null}
			{onRowClick === undefined ? (
				<div className="min-w-0 flex-1">{card}</div>
			) : (
				<div
					role="button"
					tabIndex={0}
					onClick={handleClick}
					onKeyDown={handleKeyDown}
					className="min-w-0 flex-1 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
					{card}
				</div>
			)}
		</div>
	);
});
