"use client";

import { CircleCheck, CircleDashed, CircleX, LoaderCircle, RotateCw, ScrollText, Undo2 } from "lucide-react";
import type * as React from "react";

import { PLATFORM_DISPLAY_REGION, utcEpochMs } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import {
	DataTable,
	type DataTableColumns,
	type DataTableFilter,
	type DataTableRowAction,
	type DataTableSearch,
	type DataTableSortingOptions,
} from "@workspace/ui/components/data-table";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";

type DeploymentState = "ready" | "building" | "failed" | "queued";

/** One deployment of one project. */
interface Deployment {
	readonly id: string;
	readonly project: string;
	readonly environment: "production" | "preview";
	readonly branch: string;
	readonly commit: string;
	readonly state: DeploymentState;
	/** How long the build took, in seconds; absent while it has not finished. */
	readonly durationSeconds?: number;
	/** When it started, in epoch milliseconds. */
	readonly startedAtEpochMs: number;
}

const YEAR = 2026;
const MONTH = 11;

export const DEPLOYMENTS: readonly Deployment[] = [
	{
		id: "d-1",
		project: "web",
		environment: "production",
		branch: "main",
		commit: "Fix checkout total rounding",
		state: "ready",
		durationSeconds: 94,
		startedAtEpochMs: utcEpochMs(YEAR, MONTH, 18, 9, 12),
	},
	{
		id: "d-2",
		project: "admin",
		environment: "preview",
		branch: "feat/audit-filters",
		commit: "Add actor filter to audit log",
		state: "building",
		startedAtEpochMs: utcEpochMs(YEAR, MONTH, 18, 9, 40),
	},
	{
		id: "d-3",
		project: "api",
		environment: "production",
		branch: "main",
		commit: "Raise outbox batch size",
		state: "failed",
		durationSeconds: 41,
		startedAtEpochMs: utcEpochMs(YEAR, MONTH, 18, 8, 55),
	},
	{
		id: "d-4",
		project: "web",
		environment: "preview",
		branch: "fix/nav-focus",
		commit: "Keep focus on the open menu",
		state: "ready",
		durationSeconds: 88,
		startedAtEpochMs: utcEpochMs(YEAR, MONTH, 18, 8, 20),
	},
	{
		id: "d-5",
		project: "merchant",
		environment: "preview",
		branch: "feat/payout-csv",
		commit: "Export payouts as CSV",
		state: "queued",
		startedAtEpochMs: utcEpochMs(YEAR, MONTH, 18, 9, 44),
	},
	{
		id: "d-6",
		project: "api",
		environment: "preview",
		branch: "chore/deps",
		commit: "Bump Prisma",
		state: "ready",
		durationSeconds: 120,
		startedAtEpochMs: utcEpochMs(YEAR, MONTH, 17, 17, 3),
	},
];

const STATE_STYLE: Readonly<
	Record<
		DeploymentState,
		{ readonly label: string; readonly icon: React.JSX.Element; readonly variant: "success-light" | "info-light" | "destructive-light" | "warning-light" }
	>
> = {
	ready: { label: "Ready", icon: <CircleCheck className="size-3.5" aria-hidden="true" />, variant: "success-light" },
	building: { label: "Building", icon: <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />, variant: "info-light" },
	failed: { label: "Failed", icon: <CircleX className="size-3.5" aria-hidden="true" />, variant: "destructive-light" },
	queued: { label: "Queued", icon: <CircleDashed className="size-3.5" aria-hidden="true" />, variant: "warning-light" },
};

const SECONDS_PER_MINUTE = 60;

/** A build duration as `1m 34s` or `41s`, or a dash while it is still running. */
export function formatDuration(seconds: number | undefined): string {
	if (seconds === undefined) {
		return "–";
	}
	const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
	const rest = seconds % SECONDS_PER_MINUTE;
	return minutes === 0 ? `${String(rest)}s` : `${String(minutes)}m ${String(rest)}s`;
}

const FILTERS: readonly DataTableFilter[] = [
	{
		kind: "multi-select",
		column: "state",
		label: "Status",
		options: [
			{ value: "ready", label: "Ready" },
			{ value: "building", label: "Building" },
			{ value: "failed", label: "Failed" },
			{ value: "queued", label: "Queued" },
		],
	},
	{
		kind: "multi-select",
		column: "environment",
		label: "Environment",
		options: [
			{ value: "production", label: "Production" },
			{ value: "preview", label: "Preview" },
		],
	},
	{
		kind: "multi-select",
		column: "project",
		label: "Project",
		options: ["admin", "api", "merchant", "web"].map((project) => ({ value: project, label: project })),
	},
];

/** The commit and the branch share the "Deployment" column; the search reads each from the row. */
const SEARCH: DataTableSearch<Deployment> = { keys: ["commit", "branch"] };
const SORTING: DataTableSortingOptions = { initial: [{ id: "startedAtEpochMs", desc: true }] };

function getDeploymentId(deployment: Deployment): string {
	return deployment.id;
}

const COLUMNS: DataTableColumns<Deployment> = [
	{
		id: "deployment",
		header: "Deployment",
		size: 300,
		// The value holds the commit and the branch, so it sorts and exports as one; the cell stacks them.
		accessorFn: (deployment: Deployment): string => `${deployment.commit} ${deployment.branch}`,
		cell: ({ row }): React.JSX.Element => (
			<div className="flex min-w-0 flex-col">
				<span className="truncate font-medium">{row.original.commit}</span>
				<span className="truncate font-mono text-xs text-muted-foreground">{row.original.branch}</span>
			</div>
		),
	},
	{ accessorKey: "project", header: "Project", size: 110 },
	{ accessorKey: "environment", header: "Environment", size: 130, cell: ({ row }): string => (row.original.environment === "production" ? "Production" : "Preview") },
	{
		accessorKey: "state",
		header: "Status",
		size: 130,
		cell: ({ row }): React.JSX.Element => {
			const style = STATE_STYLE[row.original.state];
			return (
				<Badge variant={style.variant}>
					{style.icon}
					{style.label}
				</Badge>
			);
		},
	},
	{
		accessorKey: "durationSeconds",
		header: "Duration",
		size: 100,
		cell: ({ row }): string => formatDuration(row.original.durationSeconds),
		meta: { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" },
	},
	{
		accessorKey: "startedAtEpochMs",
		header: "Started",
		size: 170,
		cell: ({ row }): string => formatEpochMs(row.original.startedAtEpochMs, "dateTime", PLATFORM_DISPLAY_REGION),
	},
];

const NOOP = (): void => undefined;

const ROW_ACTIONS: readonly DataTableRowAction<Deployment>[] = [
	{ key: "logs", label: "View build logs", description: "Every step of this build", icon: <ScrollText aria-hidden="true" />, onSelect: NOOP },
	{ key: "redeploy", label: "Redeploy", description: "Build this commit again", icon: <RotateCw aria-hidden="true" />, onSelect: NOOP },
	{ key: "rollback", label: "Roll back to this", description: "Make this the live deployment", icon: <Undo2 aria-hidden="true" />, onSelect: NOOP },
];

/**
 * Recipe: a deployments list. Three multi-select filters (status, environment, project) with live counts narrow the
 * list together with a search over branch and commit; the newest deployment is first.
 */
export function DataTableRecipeDeployments(): React.JSX.Element {
	return <DataTable data={DEPLOYMENTS} columns={COLUMNS} getRowId={getDeploymentId} search={SEARCH} filters={FILTERS} sorting={SORTING} rowActions={ROW_ACTIONS} />;
}
