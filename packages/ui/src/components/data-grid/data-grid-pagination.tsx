"use client";

// The grid's pagination footer: a page-size select, the "1 - 10 of 42" info
// and an adaptive row of page buttons (first, the run around the current page,
// last, and an ellipsis button for each hidden stretch). Reads the table
// through the grid context; copy comes from the `dataGrid` labels, and every
// per-component label prop beats its label.

import { Button } from "@workspace/ui/components/button";
import { useDataGrid, type DataGridGridVisitor } from "@workspace/ui/components/data-grid/data-grid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

export interface DataGridPaginationProps {
	/** Page-size choices. */
	readonly sizes?: readonly number[];
	/** Rendered instead of the page-size select while loading. */
	readonly sizesSkeleton?: React.ReactNode;
	/** Page buttons the truncated middle shows (first, last and the ellipses come on top). Clamped to at least 3. */
	readonly moreLimit?: number;
	/** Info template with `{from}`, `{to}` and `{count}` placeholders; defaults to the `paginationInfo` label. */
	readonly info?: string;
	/** Rendered instead of the info and page buttons while loading. */
	readonly infoSkeleton?: React.ReactNode;
	readonly className?: string;
	readonly rowsPerPageLabel?: string;
	readonly previousPageLabel?: string;
	readonly nextPageLabel?: string;
	readonly ellipsisText?: string;
}

/** One slot in the page row: a page button, or an ellipsis that jumps over the pages it stands for. */
export type DataGridPaginationItem =
	| { readonly type: "page"; readonly index: number }
	| { readonly type: "ellipsis"; readonly direction: "previous" | "next"; readonly target: number };

/** The smallest middle run: the current page and one neighbour each side. */
const MIN_PAGE_RUN = 3;
/** The fixed slots around the run: the first and the last page. */
const EDGE_PAGE_SLOTS = 2;
const DEFAULT_MORE_LIMIT = 5;
const DEFAULT_PAGE_SIZES: readonly number[] = [5, 10, 25, 50, 100];
const DEFAULT_SIZES_SKELETON: React.ReactNode = <Skeleton className="h-8 w-44" />;
const DEFAULT_INFO_SKELETON: React.ReactNode = <Skeleton className="h-8 w-60" />;

function pageItems(start: number, length: number): DataGridPaginationItem[] {
	return Array.from({ length }, (_, offset): DataGridPaginationItem => ({ type: "page", index: start + offset }));
}

/**
 * The adaptive window: first page, the run around the current one, last page,
 * with an ellipsis standing in for each hidden stretch. The run is always odd
 * (an even `limit` would make the head and tail rows one slot wider than the
 * middle, and the row would twitch while paging), and an ellipsis never
 * stands for a single page.
 */
export function getDataGridPaginationItems(pageIndex: number, pageCount: number, limit: number): DataGridPaginationItem[] {
	const sibling = Math.max(0, Math.floor((Math.max(Math.floor(limit), MIN_PAGE_RUN) - MIN_PAGE_RUN) / 2));
	const pages = sibling * 2 + MIN_PAGE_RUN;
	const lastIndex = pageCount - 1;

	// Two ellipses cost the width of two pages: below this there is nothing to hide.
	if (pageCount <= pages + EDGE_PAGE_SLOTS) {
		return pageItems(0, pageCount);
	}
	if (pageIndex <= sibling + EDGE_PAGE_SLOTS) {
		return [...pageItems(0, pages), { type: "ellipsis", direction: "next", target: pages }, { type: "page", index: lastIndex }];
	}
	if (pageIndex >= pageCount - sibling - MIN_PAGE_RUN) {
		return [{ type: "page", index: 0 }, { type: "ellipsis", direction: "previous", target: pageCount - pages - 1 }, ...pageItems(pageCount - pages, pages)];
	}
	return [
		{ type: "page", index: 0 },
		{ type: "ellipsis", direction: "previous", target: pageIndex - sibling - 1 },
		...pageItems(pageIndex - sibling, sibling * 2 + 1),
		{ type: "ellipsis", direction: "next", target: pageIndex + sibling + 1 },
		{ type: "page", index: lastIndex },
	];
}

/** Fills an info template's `{from}`, `{to}` and `{count}` placeholders. */
export function formatDataGridPaginationInfo(template: string, from: number, to: number, count: number): string {
	return template.replaceAll("{from}", String(from)).replaceAll("{to}", String(to)).replaceAll("{count}", String(count));
}

/** The TData-free view of the table's pagination this part renders and drives. */
interface DataGridPaginationModel {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly pageCount: number;
	readonly canPreviousPage: boolean;
	readonly canNextPage: boolean;
	readonly setPageIndex: (index: number) => void;
	readonly setPageSize: (size: number) => void;
	readonly previousPage: () => void;
	readonly nextPage: () => void;
}

const PAGINATION_VISITOR: DataGridGridVisitor<DataGridPaginationModel> = {
	visit: ({ table }) => ({
		pageIndex: table.state.pagination.pageIndex,
		pageSize: table.state.pagination.pageSize,
		pageCount: table.getPageCount(),
		canPreviousPage: table.getCanPreviousPage(),
		canNextPage: table.getCanNextPage(),
		setPageIndex: (index: number): void => {
			table.setPageIndex(index);
		},
		setPageSize: (size: number): void => {
			table.setPageSize(size);
		},
		previousPage: (): void => {
			table.previousPage();
		},
		nextPage: (): void => {
			table.nextPage();
		},
	}),
};

const pageButtonVariants = cva("min-w-8 px-1.5 text-sm", {
	variants: {
		state: {
			default: "text-muted-foreground",
			selected: "bg-accent text-accent-foreground",
		},
	},
	defaultVariants: { state: "default" },
});

const ARROW_BUTTON_CLASS_NAME = "p-0 text-sm rtl:rotate-180";

interface PageJumpButtonProps {
	readonly target: number;
	readonly label: string;
	readonly selected?: boolean;
	readonly children: React.ReactNode;
	readonly onSelect: (index: number) => void;
}

function PageJumpButton({ target, label, selected = false, children, onSelect }: PageJumpButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		if (!selected) {
			onSelect(target);
		}
	}, [onSelect, selected, target]);
	return (
		<Button
			size="sm"
			variant="ghost"
			aria-label={label}
			aria-current={selected ? "page" : undefined}
			className={pageButtonVariants({ state: selected ? "selected" : "default" })}
			onClick={handleClick}>
			{children}
		</Button>
	);
}

/** The grid's pagination footer. */
export const DataGridPagination = React.forwardRef<HTMLDivElement, DataGridPaginationProps>(function DataGridPagination(
	{
		sizes = DEFAULT_PAGE_SIZES,
		sizesSkeleton = DEFAULT_SIZES_SKELETON,
		moreLimit = DEFAULT_MORE_LIMIT,
		info,
		infoSkeleton = DEFAULT_INFO_SKELETON,
		className,
		rowsPerPageLabel,
		previousPageLabel,
		nextPageLabel,
		ellipsisText,
	},
	ref,
): React.JSX.Element {
	const { labels, recordCount, isLoading, withGrid } = useDataGrid();
	const landmarkLabels = useUiKitLabels("pagination");
	const model = React.useMemo((): DataGridPaginationModel => withGrid(PAGINATION_VISITOR), [withGrid]);
	const { pageIndex, pageSize, pageCount, setPageIndex, setPageSize } = model;

	const sizeOptions = React.useMemo((): SelectOption<string>[] => sizes.map((size) => ({ value: String(size), label: String(size) })), [sizes]);
	const handlePageSizeChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				setPageSize(Number(value));
			}
		},
		[setPageSize],
	);

	const from = recordCount === 0 ? 0 : pageIndex * pageSize + 1;
	const to = Math.min((pageIndex + 1) * pageSize, recordCount);
	const infoText = info === undefined ? labels.paginationInfo({ from, to, count: recordCount }) : formatDataGridPaginationInfo(info, from, to, recordCount);
	const resolvedRowsPerPage = rowsPerPageLabel ?? labels.rowsPerPage;
	const items = getDataGridPaginationItems(pageIndex, pageCount, moreLimit);

	return (
		<div ref={ref} data-slot="data-grid-pagination" className={cn("flex grow flex-col flex-wrap items-center justify-between gap-2.5 py-2.5 sm:flex-row sm:py-0", className)}>
			<div className="order-2 flex flex-wrap items-center gap-x-2.5 pb-2.5 sm:order-1 sm:pb-0">
				{isLoading ? (
					sizesSkeleton
				) : (
					<>
						<div className="text-sm text-muted-foreground">{resolvedRowsPerPage}</div>
						<Select<string> value={String(pageSize)} onValueChange={handlePageSizeChange} items={sizeOptions} size="sm">
							<SelectTrigger aria-label={resolvedRowsPerPage} className="w-fit min-w-16" fullWidth={false}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="start">
								{sizeOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</>
				)}
			</div>
			<div className="order-1 flex flex-col items-center justify-center gap-2.5 pt-2.5 sm:order-2 sm:flex-row sm:justify-end sm:pt-0">
				{isLoading ? (
					infoSkeleton
				) : (
					<>
						<div className="order-2 text-sm text-nowrap text-muted-foreground sm:order-1">{infoText}</div>
						{pageCount > 1 ? (
							<nav aria-label={landmarkLabels.ariaLabel} className="order-1 flex flex-wrap items-center justify-center gap-1 sm:flex-nowrap">
								<Button size="icon-sm" variant="ghost" className={ARROW_BUTTON_CLASS_NAME} onClick={model.previousPage} disabled={!model.canPreviousPage}>
									<span className="sr-only">{previousPageLabel ?? labels.previousPage}</span>
									<ChevronLeftIcon aria-hidden="true" className="size-4" />
								</Button>
								{items.map((item) =>
									item.type === "page" ? (
										<PageJumpButton
											key={`page-${String(item.index)}`}
											target={item.index}
											label={labels.goToPage(item.index + 1)}
											selected={pageIndex === item.index}
											onSelect={setPageIndex}>
											{item.index + 1}
										</PageJumpButton>
									) : (
										// Clickable, unlike a decorative ellipsis: it MOVES the user, so it is named after where.
										<PageJumpButton key={`ellipsis-${item.direction}`} target={item.target} label={labels.goToPage(item.target + 1)} onSelect={setPageIndex}>
											{ellipsisText ?? labels.paginationEllipsis}
										</PageJumpButton>
									),
								)}
								<Button size="icon-sm" variant="ghost" className={ARROW_BUTTON_CLASS_NAME} onClick={model.nextPage} disabled={!model.canNextPage}>
									<span className="sr-only">{nextPageLabel ?? labels.nextPage}</span>
									<ChevronRightIcon aria-hidden="true" className="size-4" />
								</Button>
							</nav>
						) : null}
					</>
				)}
			</div>
		</div>
	);
});
