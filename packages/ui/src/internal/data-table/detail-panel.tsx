"use client";

// DataTable's detail panel (`detail.mode: "panel"`): one row's details beside the table, or in a sheet when the table
// is narrow. ↑ and ↓ move to the previous and next row, Escape closes. It holds no state: the table tells it which
// row is open and hears every move.

import { Button } from "@workspace/ui/components/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet";
import type { DataTableLabels } from "@workspace/ui-kit-logic";
import type { RowData } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import * as React from "react";

import type { DataTableDetail } from "./props";
import { memoGeneric } from "./shared";

export interface DetailPanelProps<TData extends RowData> {
	/** The open row, or `null` when the panel is closed. */
	readonly row: TData | null;
	readonly detail: DataTableDetail<TData>;
	/** The table is narrower than the cards breakpoint: the panel is a sheet. */
	readonly isNarrow: boolean;
	readonly canStepBack: boolean;
	readonly canStepForward: boolean;
	readonly labels: DataTableLabels;
	readonly onStep: (step: -1 | 1) => void;
	readonly onClose: () => void;
}

export const DetailPanel = memoGeneric(function DetailPanel<TData extends RowData>({
	row,
	detail,
	isNarrow,
	canStepBack,
	canStepForward,
	labels,
	onStep,
	onClose,
}: DetailPanelProps<TData>): React.JSX.Element {
	const title = row === null ? labels.detailPanelLabel : (detail.title?.(row) ?? labels.detailPanelLabel);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLElement>): void => {
			if (event.key === "ArrowUp" && canStepBack) {
				event.preventDefault();
				onStep(-1);
			} else if (event.key === "ArrowDown" && canStepForward) {
				event.preventDefault();
				onStep(1);
			} else if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		},
		[canStepBack, canStepForward, onStep, onClose],
	);
	const handleStepBack = React.useCallback((): void => {
		onStep(-1);
	}, [onStep]);
	const handleStepForward = React.useCallback((): void => {
		onStep(1);
	}, [onStep]);
	const handleSheetOpenChange = React.useCallback(
		(open: boolean): void => {
			if (!open) {
				onClose();
			}
		},
		[onClose],
	);

	const steppers = (
		<div className="flex items-center gap-1">
			<Button variant="ghost" size="icon-sm" aria-label={labels.detailPanelPrevious} disabled={!canStepBack} onClick={handleStepBack}>
				<ChevronUp aria-hidden="true" />
			</Button>
			<Button variant="ghost" size="icon-sm" aria-label={labels.detailPanelNext} disabled={!canStepForward} onClick={handleStepForward}>
				<ChevronDown aria-hidden="true" />
			</Button>
		</div>
	);

	if (isNarrow) {
		return (
			<Sheet open={row !== null} onOpenChange={handleSheetOpenChange}>
				<SheetContent side="right" closeLabel={labels.detailPanelClose} onKeyDown={handleKeyDown}>
					<SheetHeader className="flex-row items-center justify-between gap-2 pe-10">
						<SheetTitle className="truncate">{title}</SheetTitle>
						{steppers}
					</SheetHeader>
					<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{row === null ? null : detail.render(row)}</div>
				</SheetContent>
			</Sheet>
		);
	}

	// A closed panel beside a wide table takes no room at all.
	if (row === null) {
		return <></>;
	}

	return (
		// The keys are heard on a wrapper with no role of its own; the panel itself is a plain, named landmark.
		<div role="presentation" onKeyDown={handleKeyDown} className="contents">
			<aside
				data-slot="data-table-detail-panel"
				aria-label={title}
				// Focusable, so ↑, ↓ and Escape work as soon as the panel is clicked into.
				tabIndex={-1}
				className="flex w-80 shrink-0 flex-col rounded-lg border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:w-96">
				<div className="flex items-center justify-between gap-2 border-b px-4 py-2">
					<h3 className="min-w-0 truncate text-sm font-medium">{title}</h3>
					<div className="flex items-center gap-1">
						{steppers}
						<Button variant="ghost" size="icon-sm" aria-label={labels.detailPanelClose} onClick={onClose}>
							<X aria-hidden="true" />
						</Button>
					</div>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto p-4">{detail.render(row)}</div>
			</aside>
		</div>
	);
});
