"use client";

import * as React from "react";

import { DataTable, type DataTableColumns, type DataTableLayout } from "@workspace/ui/components/data-table";
import { cn } from "@workspace/ui/lib/core/utils";

import { heatClassFor } from "./data-table-recipe-helpers";

/** One signup month: how many signed up, and how many were still active each month after. */
interface Cohort {
	readonly month: string;
	readonly signups: number;
	/** Active members in month 1, 2, … after signing up. Shorter for recent cohorts: those months have not happened. */
	readonly active: readonly number[];
}

const MONTHS: readonly string[] = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const PERIODS = 6;
const BASE_SIGNUPS = 400;
const SIGNUP_GROWTH = 35;
/** Sample retention: most leave in month one, then a slow decline, a little better for newer cohorts. */
const FIRST_MONTH_KEPT = 0.62;
const MONTHLY_KEPT = 0.88;
const COHORT_IMPROVEMENT = 0.015;

export const COHORTS: readonly Cohort[] = MONTHS.map((month, index) => {
	const signups = BASE_SIGNUPS + index * SIGNUP_GROWTH;
	const reached = PERIODS - index;
	const kept = FIRST_MONTH_KEPT + index * COHORT_IMPROVEMENT;
	return { month, signups, active: Array.from({ length: reached }, (_period, period) => Math.round(signups * kept * MONTHLY_KEPT ** period)) };
});

/** The share of a cohort still active in a period, from 0 to 1, or `null` for a period that has not happened yet. */
export function retentionShare(cohort: Cohort, period: number): number | null {
	const active = cohort.active.at(period);
	return active === undefined ? null : active / cohort.signups;
}

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

function RetentionCell({ share }: { readonly share: number | null }): React.JSX.Element {
	if (share === null) {
		return <span className="text-muted-foreground">–</span>;
	}
	// Shares already run 0..1, so they go on the heat scale as they are.
	return <span className={cn("-mx-3 -my-2 flex h-full items-center justify-center px-3 py-2 tabular-nums", heatClassFor(share))}>{percent.format(share)}</span>;
}

function getCohortId(cohort: Cohort): string {
	return cohort.month;
}

const COLUMNS: DataTableColumns<Cohort> = [
	{ accessorKey: "month", header: "Cohort", size: 90 },
	{ accessorKey: "signups", header: "Signups", size: 90, meta: { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" } },
	...Array.from({ length: PERIODS }, (_period, period): DataTableColumns<Cohort>[number] => ({
		id: `month-${String(period + 1)}`,
		header: `M${String(period + 1)}`,
		size: 72,
		enableSorting: false,
		accessorFn: (cohort: Cohort): number => retentionShare(cohort, period) ?? 0,
		cell: ({ row }): React.JSX.Element => <RetentionCell share={retentionShare(row.original, period)} />,
		meta: { cellClassName: "text-center", headerClassName: "text-center" },
	})),
];

const LAYOUT: DataTableLayout = { density: "compact", cellBorders: true };

/**
 * Recipe: cohort retention. Each row is a signup month; each column the share still active that many months later,
 * coloured on the shared heat scale. Months that have not happened yet show a dash, so the grid reads as a triangle.
 */
export function DataTableRecipeCohortRetention(): React.JSX.Element {
	return <DataTable data={COHORTS} columns={COLUMNS} getRowId={getCohortId} layout={LAYOUT} />;
}
