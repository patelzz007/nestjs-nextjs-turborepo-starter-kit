import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import { Card } from "@workspace/ui/components/card";
import * as React from "react";

/*
 * Bones-only silhouettes of the merchant app's own surfaces (its page header,
 * stat cards, section cards and row lists). They draw no announcement of their
 * own: compose them inside exactly one `SkeletonRegion` per loading surface.
 */

/** Short words (labels, a role) — they vary only a little. */
const LABEL_WIDTHS: readonly string[] = ["w-20", "w-28", "w-24", "w-32"];
/** Names and values in a row's cells. */
const CELL_WIDTHS: readonly string[] = ["w-3/4", "w-1/2", "w-2/3", "w-2/5", "w-3/5"];

// ── Page header ──────────────────────────────────────────────────────────────

export interface MerchantPageHeaderSkeletonProps {
	/** How many header buttons sit on the right (e.g. "Add terminal"). Default none. */
	readonly actions?: number;
	readonly className?: string;
}

/** `MerchantPageHeader`: the "Merchant console" eyebrow, the `h1`, its description and the rule beneath. */
export function MerchantPageHeaderSkeleton({ actions = 0, className }: MerchantPageHeaderSkeletonProps): React.JSX.Element {
	return (
		<div data-slot="merchant-page-header-skeleton" className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5", className)}>
			<div className="flex min-w-0 flex-col gap-2.5">
				<Skeleton variant="text" className="h-3 w-32" />
				<Skeleton className="h-8 w-56 max-w-full sm:h-9" />
				<Skeleton variant="text" className="h-4 w-96 max-w-full" />
			</div>
			{actions > 0 ? (
				<div className="flex gap-2">
					{placeholderKeys("action", actions).map((key): React.JSX.Element => (
						<Skeleton key={key} className="h-9 w-32" />
					))}
				</div>
			) : null}
		</div>
	);
}

// ── Stat cards ───────────────────────────────────────────────────────────────

export interface MerchantStatCardsSkeletonProps {
	readonly count: number;
	/** The real row's column classes (e.g. `sm:grid-cols-3`), so each card lands in its own cell. */
	readonly className?: string;
}

/** A row of `StatCard`s: uppercase label, headline value and hint beside the icon tile. */
export function MerchantStatCardsSkeleton({ count, className }: MerchantStatCardsSkeletonProps): React.JSX.Element {
	return (
		<div data-slot="merchant-stat-cards-skeleton" className={cn("grid gap-4", className)}>
			{placeholderKeys("stat", count).map((key, index): React.JSX.Element => (
				<div key={key} data-slot="merchant-stat-card-skeleton" className="rounded-lg border border-border bg-card p-4 shadow-sm inset-shadow-edge">
					<div className="flex items-start justify-between gap-3">
						<div className="flex min-w-0 flex-1 flex-col gap-2.5">
							<Skeleton variant="text" className={cn("h-3", cycledWidth(LABEL_WIDTHS, index))} />
							<Skeleton className="h-7 w-16" />
							<Skeleton variant="text" className="h-3 w-40 max-w-full" />
						</div>
						<Skeleton className="size-10 rounded-lg" />
					</div>
				</div>
			))}
		</div>
	);
}

// ── Headings ─────────────────────────────────────────────────────────────────

export interface MerchantHeadingSkeletonProps {
	/** Draw the description line under the title. Default true. */
	readonly withDescription?: boolean;
	readonly className?: string;
}

/** A section's `h2` and its one-line description. */
export function MerchantHeadingSkeleton({ withDescription = true, className }: MerchantHeadingSkeletonProps): React.JSX.Element {
	return (
		<div className={cn("flex min-w-0 flex-col gap-2", className)}>
			<Skeleton variant="text" className="h-4.5 w-44 max-w-full" />
			{withDescription ? <Skeleton variant="text" className="h-3.5 w-80 max-w-full" /> : null}
		</div>
	);
}

// ── Section card ─────────────────────────────────────────────────────────────

export interface MerchantSectionCardSkeletonProps {
	/** Draw a control on the right of the header (a filter group, a button). Default false. */
	readonly withHeaderAction?: boolean;
	readonly children: React.ReactNode;
	readonly className?: string;
}

/** A bordered section card with a ruled header (title + description), as the terminals and API-key sections draw it. */
export function MerchantSectionCardSkeleton({ withHeaderAction = false, children, className }: MerchantSectionCardSkeletonProps): React.JSX.Element {
	return (
		<Card className={cn("gap-0 py-0", className)}>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
				<MerchantHeadingSkeleton />
				{withHeaderAction ? <Skeleton className="h-9 w-48" /> : null}
			</div>
			{children}
		</Card>
	);
}

// ── Grid rows ────────────────────────────────────────────────────────────────

export interface MerchantGridRowsSkeletonProps {
	readonly rows: number;
	/** The real list's row grid (its exported `*_ROW_GRID`), so every cell lines up with the loaded rows. */
	readonly rowGridClassName: string;
	/** Plain text cells between the leading cell (icon + name + status) and the actions. */
	readonly textCells: number;
	/** Buttons in the trailing cell. */
	readonly actions: number;
}

/** Divided list rows: an icon tile with a name and status line, text cells, then the row's buttons. */
export function MerchantGridRowsSkeleton({ rows, rowGridClassName, textCells, actions }: MerchantGridRowsSkeletonProps): React.JSX.Element {
	const cellKeys = placeholderKeys("cell", textCells);
	const actionKeys = placeholderKeys("action", actions);
	return (
		<ul className="divide-y divide-border">
			{placeholderKeys("row", rows).map((rowKey, rowIndex): React.JSX.Element => (
				<li key={rowKey} data-slot="merchant-grid-row-skeleton" className={cn(rowGridClassName, "py-4")}>
					<div className="flex min-w-0 items-center gap-3">
						<Skeleton className="size-10 rounded-lg" />
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<Skeleton variant="text" className={cn("h-4", cycledWidth(CELL_WIDTHS, rowIndex))} />
							<Skeleton variant="text" className="h-3 w-20" />
						</div>
					</div>
					{cellKeys.map((cellKey, cellIndex): React.JSX.Element => (
						<Skeleton key={cellKey} variant="text" className={cn("h-3.5", cycledWidth(CELL_WIDTHS, rowIndex + cellIndex + 1))} />
					))}
					<div className="flex gap-2 lg:justify-end">
						{actionKeys.map((actionKey): React.JSX.Element => (
							<Skeleton key={actionKey} className="h-8 w-20" />
						))}
					</div>
				</li>
			))}
		</ul>
	);
}

// ── Bordered rows ────────────────────────────────────────────────────────────

export interface MerchantBorderedRowsSkeletonProps {
	readonly rows: number;
	/** Text lines under each row's title. */
	readonly lines: number;
	/** What sits on the right of each row: a badge, a button, a line of text (a time), or nothing. */
	readonly trailing: "badge" | "button" | "text" | "none";
	/** Each row's surface — a nested bordered box (`card`) or a full kit `Card` (`panel`). */
	readonly surface: "card" | "panel";
}

const BORDERED_ROW_SURFACE: Readonly<Record<MerchantBorderedRowsSkeletonProps["surface"], string>> = {
	card: "rounded-lg border border-border bg-card p-4",
	panel: "rounded-xl border border-border bg-card px-5 py-4 shadow-xs",
};

const BORDERED_ROW_TRAILING: Readonly<Record<Exclude<MerchantBorderedRowsSkeletonProps["trailing"], "none">, string>> = {
	badge: "h-5 w-16 rounded-full",
	button: "h-8 w-20",
	text: "h-3.5 w-32 rounded-full",
};

/** Stacked bordered rows (team members, invitations, redemptions): a title, lines of detail and a trailing badge, button or time. */
export function MerchantBorderedRowsSkeleton({ rows, lines, trailing, surface }: MerchantBorderedRowsSkeletonProps): React.JSX.Element {
	const lineKeys = placeholderKeys("line", lines);
	return (
		<div className="flex flex-col gap-3">
			{placeholderKeys("row", rows).map((rowKey, rowIndex): React.JSX.Element => (
				<div key={rowKey} data-slot="merchant-bordered-row-skeleton" className={BORDERED_ROW_SURFACE[surface]}>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<Skeleton variant="text" className={cn("h-4", cycledWidth(CELL_WIDTHS, rowIndex))} />
							{lineKeys.map((lineKey, lineIndex): React.JSX.Element => (
								<Skeleton key={lineKey} variant="text" className={cn("h-3", cycledWidth(CELL_WIDTHS, rowIndex + lineIndex + 1))} />
							))}
						</div>
						{trailing === "none" ? null : <Skeleton className={BORDERED_ROW_TRAILING[trailing]} />}
					</div>
				</div>
			))}
		</div>
	);
}
