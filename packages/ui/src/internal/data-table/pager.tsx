"use client";

// DataTable's pager: "Showing 1 to 10 of 42 results", a page-size select, and first / previous / page numbers / next /
// last. It is told the page (it never reads the table), so one pager serves client and server tables alike. The page
// numbers use the engine's adaptive window (first, the run around the current page, last, an ellipsis per gap).

import { Button } from "@workspace/ui/components/button";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { formatDataTableLabel, getDataTablePageRange, type DataTableLabels, type TableEngineLabels } from "@workspace/ui-kit-logic";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import * as React from "react";

import { getTableEnginePaginationItems } from "../table-engine/table-engine-pagination";

/** How many page buttons the run around the current page shows. */
const PAGE_BUTTON_RUN = 5;

interface PageButtonProps {
	readonly pageIndex: number;
	readonly isCurrent: boolean;
	readonly ariaLabel: string;
	readonly children: React.ReactNode;
	readonly onPageChange: (pageIndex: number) => void;
}

const PageButton = React.memo(function PageButton({ pageIndex, isCurrent, ariaLabel, children, onPageChange }: PageButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		if (!isCurrent) {
			onPageChange(pageIndex);
		}
	}, [isCurrent, onPageChange, pageIndex]);
	return (
		<Button
			variant={isCurrent ? "default" : "outline"}
			size="sm"
			onClick={handleClick}
			className="size-8 p-0"
			aria-label={ariaLabel}
			aria-current={isCurrent ? "page" : undefined}>
			{children}
		</Button>
	);
});

export interface PagerProps {
	/** The current page, starting at 0. */
	readonly pageIndex: number;
	readonly pageSize: number;
	/** Every row the pager counts: the filtered rows of a client table, or the server's total. */
	readonly totalCount: number;
	readonly pageSizeOptions: readonly number[];
	/** Shows a spinner beside the count while the next page loads. */
	readonly isRefreshing: boolean;
	readonly labels: DataTableLabels;
	readonly engineLabels: TableEngineLabels;
	readonly onPageChange: (pageIndex: number) => void;
	readonly onPageSizeChange: (pageSize: number) => void;
}

export const Pager = React.memo(function Pager({
	pageIndex,
	pageSize,
	totalCount,
	pageSizeOptions,
	isRefreshing,
	labels,
	engineLabels,
	onPageChange,
	onPageSizeChange,
}: PagerProps): React.JSX.Element {
	const landmarkLabels = useUiKitLabels("pagination");
	const showId = React.useId();
	const perPageId = React.useId();
	const { from, to, pageCount } = getDataTablePageRange(pageIndex, pageSize, totalCount);
	const lastPageIndex = pageCount - 1;
	const canPrevious = pageIndex > 0;
	const canNext = pageIndex < lastPageIndex;

	const sizeOptions = React.useMemo(
		(): readonly SelectOption<string>[] => pageSizeOptions.map((size): SelectOption<string> => ({ value: String(size), label: String(size) })),
		[pageSizeOptions],
	);
	const handlePageSizeChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				onPageSizeChange(Number(value));
			}
		},
		[onPageSizeChange],
	);
	const handleFirst = React.useCallback((): void => {
		onPageChange(0);
	}, [onPageChange]);
	const handlePrevious = React.useCallback((): void => {
		onPageChange(pageIndex - 1);
	}, [onPageChange, pageIndex]);
	const handleNext = React.useCallback((): void => {
		onPageChange(pageIndex + 1);
	}, [onPageChange, pageIndex]);
	const handleLast = React.useCallback((): void => {
		onPageChange(lastPageIndex);
	}, [lastPageIndex, onPageChange]);

	const items = getTableEnginePaginationItems(pageIndex, pageCount, PAGE_BUTTON_RUN);

	return (
		<div
			data-slot="data-table-pager"
			className="flex flex-col items-center justify-center gap-6 py-6 sm:flex-row sm:flex-wrap md:justify-center lg:justify-between print:hidden">
			<div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
				{isRefreshing ? <Loader2 className="size-3.5 shrink-0 motion-safe:animate-spin" aria-hidden="true" /> : null}
				<span>{formatDataTableLabel(labels.showingResults, { from, to, total: totalCount })}</span>
				{pageCount > 1 ? <span>{formatDataTableLabel(labels.pageOfTotal, { page: pageIndex + 1, totalPages: pageCount })}</span> : null}
			</div>
			<div className="flex items-center gap-2">
				<span id={showId} className="text-sm text-muted-foreground">
					{labels.showPerPage}
				</span>
				<Select<string> value={String(pageSize)} onValueChange={handlePageSizeChange} items={sizeOptions}>
					<SelectTrigger className="w-20" aria-labelledby={`${showId} ${perPageId}`}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{sizeOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span id={perPageId} className="text-sm text-muted-foreground">
					{labels.perPage}
				</span>
			</div>
			<nav aria-label={landmarkLabels.ariaLabel} className="flex items-center gap-2">
				<Button variant="outline" size="sm" onClick={handleFirst} disabled={!canPrevious} aria-label={labels.firstPageAriaLabel} className="rtl:rotate-180">
					<ChevronsLeft className="size-4" aria-hidden="true" />
				</Button>
				<Button variant="outline" size="sm" onClick={handlePrevious} disabled={!canPrevious} aria-label={labels.previousPageAriaLabel} className="rtl:rotate-180">
					<ChevronLeft className="size-4" aria-hidden="true" />
				</Button>
				{pageCount > 1 ? (
					<div className="flex items-center gap-1">
						{items.map((item) =>
							item.type === "page" ? (
								<PageButton
									key={`page-${String(item.index)}`}
									pageIndex={item.index}
									isCurrent={item.index === pageIndex}
									ariaLabel={formatDataTableLabel(labels.goToPageAriaLabel, { page: item.index + 1 })}
									onPageChange={onPageChange}>
									{item.index + 1}
								</PageButton>
							) : (
								// The ellipsis moves the reader, so it is named after where it goes.
								<PageButton
									key={`ellipsis-${item.direction}`}
									pageIndex={item.target}
									isCurrent={false}
									ariaLabel={formatDataTableLabel(labels.goToPageAriaLabel, { page: item.target + 1 })}
									onPageChange={onPageChange}>
									{engineLabels.paginationEllipsis}
								</PageButton>
							),
						)}
					</div>
				) : null}
				<Button variant="outline" size="sm" onClick={handleNext} disabled={!canNext} aria-label={labels.nextPageAriaLabel} className="rtl:rotate-180">
					<ChevronRight className="size-4" aria-hidden="true" />
				</Button>
				<Button variant="outline" size="sm" onClick={handleLast} disabled={!canNext} aria-label={labels.lastPageAriaLabel} className="rtl:rotate-180">
					<ChevronsRight className="size-4" aria-hidden="true" />
				</Button>
			</nav>
		</div>
	);
});
