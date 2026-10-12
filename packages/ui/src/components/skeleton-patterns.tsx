import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/core/utils";
import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/*
 * Layout-shaped loading placeholders. Each pattern mirrors the silhouette of a
 * real kit surface (page header, KPI cards, card-wrapped data table, card
 * grid, list, form, detail sheet, chart, prose) so content lands where the
 * placeholder stood, without a jump. Patterns are bones only — wrap one or
 * more of them in a single `SkeletonRegion`, which owns the screen-reader
 * announcement and the delayed fade-in.
 */

/**
 * Text-line widths, cycled by row so a column of placeholders reads like
 * ragged real copy instead of a solid block. Order is deliberate: no two
 * neighbours share a width.
 */
const RAGGED_LINE_WIDTHS: readonly string[] = ["w-11/12", "w-3/5", "w-4/5", "w-1/2", "w-2/3", "w-3/4"];
/** Field-label widths — labels are short words, so they vary only a little. */
const FIELD_LABEL_WIDTHS: readonly string[] = ["w-24", "w-32", "w-20", "w-28"];
/** Running-text widths — a paragraph's lines are nearly full until its last one. */
const PROSE_LINE_WIDTHS: readonly string[] = ["w-full", "w-11/12", "w-full", "w-5/6"];
/** Narrower widths for table cells and short values (names, amounts, dates). */
const RAGGED_CELL_WIDTHS: readonly string[] = ["w-3/4", "w-1/2", "w-2/3", "w-2/5", "w-3/5"];
/**
 * Bar heights (percent of the plot) for the chart placeholder — a gentle
 * rise-and-settle shape that reads as "a chart" without implying any data.
 */
const CHART_SILHOUETTE_PERCENTS: readonly number[] = [38, 52, 45, 63, 58, 74, 66, 81, 72, 88, 79, 92];

// ── Surface ──────────────────────────────────────────────────────────────────

/** Whether a pattern draws its own card, or sits bare inside a surface the page already has. */
export type SkeletonSurface = "card" | "plain";

interface SurfaceProps extends React.ComponentProps<"div"> {
	readonly surface: SkeletonSurface;
}

const SkeletonSurfaceFrame = React.forwardRef<HTMLDivElement, SurfaceProps>(function SkeletonSurfaceFrame({ surface, className, children, ...props }, ref): React.JSX.Element {
	if (surface === "plain") {
		return (
			<div ref={ref} className={cn("flex flex-col gap-6", className)} {...props}>
				{children}
			</div>
		);
	}
	return (
		<Card ref={ref} className={className} {...props}>
			{children}
		</Card>
	);
});

/** A card header's title and optional description — the same rhythm as `CardTitle` + `CardDescription`. */
function SkeletonCardHeading({ withDescription, action }: { readonly withDescription: boolean; readonly action: boolean }): React.JSX.Element {
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<Skeleton variant="text" className="h-4.5 w-40 max-w-full" />
				{withDescription ? <Skeleton variant="text" className="h-3.5 w-64 max-w-full" /> : null}
			</div>
			{action ? <Skeleton className="h-8 w-24" /> : null}
		</div>
	);
}

// ── Page header ──────────────────────────────────────────────────────────────

export interface PageHeaderSkeletonProps extends React.ComponentProps<"div"> {
	/** Show the subtitle line under the title. Default true. */
	readonly withDescription?: boolean;
	/** How many header buttons sit on the right (e.g. "New product"). Default none. */
	readonly actions?: number;
}

/** A page's `h1` + subtitle (+ action buttons), matching the panels' `text-2xl` page header. */
export const PageHeaderSkeleton = React.forwardRef<HTMLDivElement, PageHeaderSkeletonProps>(function PageHeaderSkeleton(
	{ withDescription = true, actions = 0, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} data-slot="page-header-skeleton" className={cn("flex flex-wrap items-end justify-between gap-4", className)} {...props}>
			<div className="flex min-w-0 flex-col gap-2.5">
				<Skeleton className="h-7 w-56 max-w-full" />
				{withDescription ? <Skeleton variant="text" className="h-4 w-80 max-w-full" /> : null}
			</div>
			{actions > 0 ? (
				<div className="flex gap-2">
					{placeholderKeys("action", actions).map((key) => (
						<Skeleton key={key} className="h-9 w-28" />
					))}
				</div>
			) : null}
		</div>
	);
});
PageHeaderSkeleton.displayName = "PageHeaderSkeleton";

// ── Stat cards ───────────────────────────────────────────────────────────────

const DEFAULT_STAT_CARD_COUNT = 4;

const statGridVariants = cva("grid grid-cols-1 gap-4 sm:grid-cols-2", {
	variants: {
		columns: {
			2: "",
			3: "xl:grid-cols-3",
			4: "xl:grid-cols-4",
		},
	},
	defaultVariants: { columns: 4 },
});

export interface StatCardsSkeletonProps extends React.ComponentProps<"div">, VariantProps<typeof statGridVariants> {
	/** How many KPI cards. Default 4. */
	readonly count?: number;
}

/** A row of `KpiStatCard` silhouettes: label + icon tile, headline value, comparison line. */
export const StatCardsSkeleton = React.forwardRef<HTMLDivElement, StatCardsSkeletonProps>(function StatCardsSkeleton(
	{ count = DEFAULT_STAT_CARD_COUNT, columns, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} data-slot="stat-cards-skeleton" className={cn(statGridVariants({ columns }), className)} {...props}>
			{placeholderKeys("stat", count).map((key) => (
				<Card key={key} size="sm" className="border-border/80">
					<CardContent className="flex flex-col gap-3">
						<div className="flex items-center justify-between gap-2">
							<Skeleton variant="text" className="h-3.5 w-24" />
							<Skeleton className="size-8 rounded-lg" />
						</div>
						<Skeleton className="h-8 w-28" />
						<Skeleton variant="text" className="h-3.5 w-36" />
					</CardContent>
				</Card>
			))}
		</div>
	);
});
StatCardsSkeleton.displayName = "StatCardsSkeleton";

// ── Data table ───────────────────────────────────────────────────────────────

const DEFAULT_TABLE_ROWS = 8;
const DEFAULT_TABLE_COLUMNS = 5;
/** Columns past this many are hidden below `md`, as the real tables collapse on phones. */
const MOBILE_VISIBLE_TABLE_COLUMNS = 2;

export interface TableSkeletonProps extends React.ComponentProps<"div"> {
	readonly rows?: number;
	readonly columns?: number;
	/** Draw the search + filter toolbar above the table. Default true. */
	readonly withToolbar?: boolean;
	/** Draw the "showing x of y" + pager row below the table. Default true. */
	readonly withPagination?: boolean;
	/** Lead each row with an avatar (people, merchants). Default false. */
	readonly withAvatar?: boolean;
	/** Draw a description line under the card title (card surface only). Default false. */
	readonly withDescription?: boolean;
	/** Card (default) or bare, for a table that already sits inside a card. */
	readonly surface?: SkeletonSurface;
}

/** A card-wrapped `DataTable` silhouette: card title, toolbar, header row, body rows, pager. */
export const TableSkeleton = React.forwardRef<HTMLDivElement, TableSkeletonProps>(function TableSkeleton(
	{
		rows = DEFAULT_TABLE_ROWS,
		columns = DEFAULT_TABLE_COLUMNS,
		withToolbar = true,
		withPagination = true,
		withAvatar = false,
		withDescription = false,
		surface = "card",
		className,
		...props
	},
	ref,
): React.JSX.Element {
	const columnKeys = placeholderKeys("column", columns);
	const body = (
		<div className="flex flex-col gap-4">
			{withToolbar ? (
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<Skeleton className="h-9 w-full sm:w-72" />
					<div className="flex gap-2">
						<Skeleton className="h-9 w-28" />
						<Skeleton className="h-9 w-24" />
					</div>
					<Skeleton className="hidden h-9 w-9 sm:ml-auto sm:block" />
				</div>
			) : null}
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader className="bg-muted/40">
						<TableRow className="hover:bg-transparent">
							{columnKeys.map((key, columnIndex) => (
								<TableHead key={key} className={cn("h-10", columnIndex >= MOBILE_VISIBLE_TABLE_COLUMNS && "hidden md:table-cell")}>
									<Skeleton variant="text" className="h-3 w-16" />
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{placeholderKeys("row", rows).map((rowKey, rowIndex) => (
							<TableRow key={rowKey} className="hover:bg-transparent">
								{columnKeys.map((key, columnIndex) => (
									<TableCell key={key} className={cn("p-4", columnIndex >= MOBILE_VISIBLE_TABLE_COLUMNS && "hidden md:table-cell")}>
										{columnIndex === 0 && withAvatar ? (
											<div className="flex items-center gap-3">
												<Skeleton variant="circular" className="size-8" />
												<div className="flex min-w-0 flex-1 flex-col gap-1.5">
													<Skeleton variant="text" className={cn("h-3.5", cycledWidth(RAGGED_CELL_WIDTHS, rowIndex))} />
													<Skeleton variant="text" className="h-3 w-2/5" />
												</div>
											</div>
										) : (
											<Skeleton variant="text" className={cn("h-3.5", cycledWidth(RAGGED_CELL_WIDTHS, rowIndex + columnIndex))} />
										)}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			{withPagination ? (
				<div className="flex items-center justify-between gap-4">
					<Skeleton variant="text" className="h-3.5 w-32" />
					<div className="flex gap-2">
						<Skeleton className="h-8 w-20" />
						<Skeleton className="h-8 w-8" />
						<Skeleton className="h-8 w-8" />
					</div>
				</div>
			) : null}
		</div>
	);

	return (
		<SkeletonSurfaceFrame ref={ref} surface={surface} data-slot="table-skeleton" className={className} {...props}>
			{surface === "card" ? (
				<>
					<CardHeader>
						<SkeletonCardHeading withDescription={withDescription} action={false} />
					</CardHeader>
					<CardContent>{body}</CardContent>
				</>
			) : (
				body
			)}
		</SkeletonSurfaceFrame>
	);
});
TableSkeleton.displayName = "TableSkeleton";

// ── Card grid ────────────────────────────────────────────────────────────────

const DEFAULT_CARD_GRID_COUNT = 6;

const cardGridVariants = cva("grid grid-cols-1 gap-4 sm:grid-cols-2", {
	variants: {
		columns: {
			2: "",
			3: "xl:grid-cols-3",
			4: "lg:grid-cols-3 xl:grid-cols-4",
		},
	},
	defaultVariants: { columns: 3 },
});

export interface CardGridSkeletonProps extends React.ComponentProps<"div">, VariantProps<typeof cardGridVariants> {
	readonly count?: number;
	/** Lead each card with an image area (catalogs). Default true. */
	readonly withMedia?: boolean;
}

/** A grid of content cards — image, tag, title, two lines of copy, price/action footer. */
export const CardGridSkeleton = React.forwardRef<HTMLDivElement, CardGridSkeletonProps>(function CardGridSkeleton(
	{ count = DEFAULT_CARD_GRID_COUNT, columns, withMedia = true, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} data-slot="card-grid-skeleton" className={cn(cardGridVariants({ columns }), className)} {...props}>
			{placeholderKeys("card", count).map((key, index) => (
				<Card key={key} className={cn(withMedia && "pt-0")}>
					{withMedia ? <Skeleton className="aspect-[16/10] w-full rounded-none" /> : null}
					<CardContent className="flex flex-col gap-3">
						<Skeleton variant="text" className="h-5 w-20" />
						<Skeleton variant="text" className={cn("h-4.5", cycledWidth(RAGGED_LINE_WIDTHS, index))} />
						<div className="flex flex-col gap-2">
							<Skeleton variant="text" className="h-3.5 w-full" />
							<Skeleton variant="text" className="h-3.5 w-2/3" />
						</div>
						<div className="mt-2 flex items-center justify-between gap-4">
							<Skeleton className="h-6 w-20" />
							<Skeleton className="h-9 w-24" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
});
CardGridSkeleton.displayName = "CardGridSkeleton";

// ── List ─────────────────────────────────────────────────────────────────────

const DEFAULT_LIST_ROWS = 5;

const listLeadingVariants = cva("", {
	variants: {
		leading: {
			avatar: "size-10 rounded-full",
			icon: "size-10 rounded-lg",
			none: "hidden",
		},
	},
	defaultVariants: { leading: "avatar" },
});

export interface ListSkeletonProps extends React.ComponentProps<"div">, VariantProps<typeof listLeadingVariants> {
	readonly rows?: number;
	/** Draw a trailing action/status per row. Default true. */
	readonly withTrailing?: boolean;
	/** Draw the card's title above the rows (card surface only). Default true. */
	readonly withHeading?: boolean;
	readonly surface?: SkeletonSurface;
}

/** A divided list of rows — leading avatar/icon, two text lines, trailing badge or button. */
export const ListSkeleton = React.forwardRef<HTMLDivElement, ListSkeletonProps>(function ListSkeleton(
	{ rows = DEFAULT_LIST_ROWS, leading, withTrailing = true, withHeading = true, surface = "card", className, ...props },
	ref,
): React.JSX.Element {
	const items = (
		<ul className="flex flex-col divide-y divide-border/70">
			{placeholderKeys("item", rows).map((key, index) => (
				<li key={key} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
					<Skeleton className={listLeadingVariants({ leading })} />
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Skeleton variant="text" className={cn("h-3.5", cycledWidth(RAGGED_CELL_WIDTHS, index))} />
						<Skeleton variant="text" className={cn("h-3", cycledWidth(RAGGED_LINE_WIDTHS, index + 1), "max-w-80")} />
					</div>
					{withTrailing ? <Skeleton className="h-7 w-20" /> : null}
				</li>
			))}
		</ul>
	);

	return (
		<SkeletonSurfaceFrame ref={ref} surface={surface} data-slot="list-skeleton" className={className} {...props}>
			{surface === "card" ? (
				<>
					{withHeading ? (
						<CardHeader>
							<SkeletonCardHeading withDescription action={false} />
						</CardHeader>
					) : null}
					<CardContent>{items}</CardContent>
				</>
			) : (
				items
			)}
		</SkeletonSurfaceFrame>
	);
});
ListSkeleton.displayName = "ListSkeleton";

// ── Form ─────────────────────────────────────────────────────────────────────

const DEFAULT_FORM_FIELDS = 4;

const formFieldGridVariants = cva("grid grid-cols-1 gap-x-4 gap-y-5", {
	variants: {
		columns: {
			1: "",
			2: "md:grid-cols-2",
		},
	},
	defaultVariants: { columns: 1 },
});

/** Input height — match the form's real controls (`Input` is h-9; the auth forms use h-11). */
const formInputVariants = cva("w-full", {
	variants: {
		inputSize: {
			default: "h-9",
			lg: "h-11",
		},
	},
	defaultVariants: { inputSize: "default" },
});

export interface FormSkeletonProps extends React.ComponentProps<"div">, VariantProps<typeof formFieldGridVariants>, VariantProps<typeof formInputVariants> {
	readonly fields?: number;
	/** Draw the submit/cancel row. Default true. */
	readonly withActions?: boolean;
	/** Draw the card title + description above the fields (card surface only). Default true. */
	readonly withHeading?: boolean;
	readonly surface?: SkeletonSurface;
}

/** A form silhouette — label over input per field, then the action row aligned to the end. */
export const FormSkeleton = React.forwardRef<HTMLDivElement, FormSkeletonProps>(function FormSkeleton(
	{ fields = DEFAULT_FORM_FIELDS, columns, inputSize, withActions = true, withHeading = true, surface = "card", className, ...props },
	ref,
): React.JSX.Element {
	const body = (
		<div className="flex flex-col gap-6">
			<div className={formFieldGridVariants({ columns })}>
				{placeholderKeys("field", fields).map((key, index) => (
					<div key={key} className="flex flex-col gap-2">
						<Skeleton variant="text" className={cn("h-3.5", cycledWidth(FIELD_LABEL_WIDTHS, index))} />
						<Skeleton className={formInputVariants({ inputSize })} />
					</div>
				))}
			</div>
			{withActions ? (
				<div className="flex justify-end gap-2">
					<Skeleton className="h-9 w-20" />
					<Skeleton className="h-9 w-28" />
				</div>
			) : null}
		</div>
	);

	return (
		<SkeletonSurfaceFrame ref={ref} surface={surface} data-slot="form-skeleton" className={className} {...props}>
			{surface === "card" ? (
				<>
					{withHeading ? (
						<CardHeader>
							<SkeletonCardHeading withDescription action={false} />
						</CardHeader>
					) : null}
					<CardContent>{body}</CardContent>
				</>
			) : (
				body
			)}
		</SkeletonSurfaceFrame>
	);
});
FormSkeleton.displayName = "FormSkeleton";

// ── Detail (key/value sheet) ─────────────────────────────────────────────────

const DEFAULT_DETAIL_ROWS = 6;

export interface DetailSkeletonProps extends React.ComponentProps<"div"> {
	/** How many label/value pairs. Default 6. */
	readonly rows?: number;
	/** Draw a header action (e.g. "Edit"). Default false. */
	readonly withAction?: boolean;
	readonly surface?: SkeletonSurface;
}

/** A record's detail sheet — a two-column grid of small labels over values. */
export const DetailSkeleton = React.forwardRef<HTMLDivElement, DetailSkeletonProps>(function DetailSkeleton(
	{ rows = DEFAULT_DETAIL_ROWS, withAction = false, surface = "card", className, ...props },
	ref,
): React.JSX.Element {
	const pairs = (
		<div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
			{placeholderKeys("pair", rows).map((key, index) => (
				<div key={key} className="flex flex-col gap-2">
					<Skeleton variant="text" className="h-3 w-20" />
					<Skeleton variant="text" className={cn("h-4", cycledWidth(RAGGED_CELL_WIDTHS, index))} />
				</div>
			))}
		</div>
	);

	return (
		<SkeletonSurfaceFrame ref={ref} surface={surface} data-slot="detail-skeleton" className={className} {...props}>
			{surface === "card" ? (
				<>
					<CardHeader>
						<SkeletonCardHeading withDescription={false} action={withAction} />
					</CardHeader>
					<CardContent>{pairs}</CardContent>
				</>
			) : (
				pairs
			)}
		</SkeletonSurfaceFrame>
	);
});
DetailSkeleton.displayName = "DetailSkeleton";

// ── Chart ────────────────────────────────────────────────────────────────────

const chartPlotVariants = cva("flex items-end gap-1.5 border-b border-border/70 sm:gap-2.5", {
	variants: {
		size: {
			sm: "h-40",
			default: "h-64",
			lg: "h-80",
		},
	},
	defaultVariants: { size: "default" },
});

export interface ChartSkeletonProps extends React.ComponentProps<"div">, VariantProps<typeof chartPlotVariants> {
	/** Draw the range/interval control in the header. Default true. */
	readonly withControls?: boolean;
}

/** A chart card — title, description and range control over a bar silhouette and a baseline. */
export const ChartSkeleton = React.forwardRef<HTMLDivElement, ChartSkeletonProps>(function ChartSkeleton(
	{ size, withControls = true, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<Card ref={ref} data-slot="chart-skeleton" className={className} {...props}>
			<CardHeader>
				<SkeletonCardHeading withDescription action={withControls} />
			</CardHeader>
			<CardContent>
				<div className={chartPlotVariants({ size })}>
					{CHART_SILHOUETTE_PERCENTS.map((percent, index) => (
						<Skeleton key={`bar-${String(index)}`} className="flex-1 rounded-t-sm rounded-b-none" style={{ height: `${String(percent)}%` }} />
					))}
				</div>
			</CardContent>
		</Card>
	);
});
ChartSkeleton.displayName = "ChartSkeleton";

// ── Prose ────────────────────────────────────────────────────────────────────

const DEFAULT_PROSE_LINES = 4;

export interface ProseSkeletonProps extends React.ComponentProps<"div"> {
	/** Lines of running text. Default 4. */
	readonly lines?: number;
}

/** A paragraph of running text — full-width lines that end on a short one. */
export const ProseSkeleton = React.forwardRef<HTMLDivElement, ProseSkeletonProps>(function ProseSkeleton(
	{ lines = DEFAULT_PROSE_LINES, className, ...props },
	ref,
): React.JSX.Element {
	const keys = placeholderKeys("line", lines);
	return (
		<div ref={ref} data-slot="prose-skeleton" className={cn("flex flex-col gap-2.5", className)} {...props}>
			{keys.map((key, index) => (
				<Skeleton key={key} variant="text" className={cn("h-3.5", index === keys.length - 1 ? "w-2/5" : cycledWidth(PROSE_LINE_WIDTHS, index))} />
			))}
		</div>
	);
});
ProseSkeleton.displayName = "ProseSkeleton";
