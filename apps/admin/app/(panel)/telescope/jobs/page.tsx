"use client";

// ============================================
// app/(panel)/telescope/jobs/page.tsx
// Feature 3 — queue/job inspection. Every task wrapped in TelescopeJobRunner
// shows up here: name, status, duration, payload size, queue latency
// (startedAt - enqueuedAt) and the correlation it ran inside.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { TelescopeJobsListQuerySchema, type TelescopeJobLogEntry, type TelescopeJobsListQuery, type TelescopeStreamEvent } from "@workspace/shared";

import { LiveFeedCard } from "@/components/telescope/live-feed-card";
import { durationLabel, formatTime, jobStatusTone, streamEventTarget } from "@/lib/telescope";
import { useTelescopeLive } from "@/lib/use-telescope-live";

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const STATUS_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "succeeded", label: "Succeeded" },
	{ value: "failed", label: "Failed" },
	{ value: "running", label: "Running" },
];

export default function TelescopeJobsPage(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const [status, setStatus] = useState<string>("all");
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(20);

	const query: TelescopeJobsListQuery = useMemo((): TelescopeJobsListQuery => {
		const draft: Record<string, string | number> = { page, pageSize };
		if (status !== "all") draft.status = status;
		return TelescopeJobsListQuerySchema.parse(draft);
	}, [page, pageSize, status]);

	const listQuery = api.procedure(telescopeEndpoints.jobs(query)).useQuery({ query }, { placeholderData: (previous) => previous });

	const rows: readonly TelescopeJobLogEntry[] = useMemo(() => listQuery.data?.data.list.items ?? [], [listQuery.data]);
	const totalCount: number = listQuery.data?.data.list.total ?? 0;

	const handleManualPaginationChange = useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageSize(nextPageSize);
	}, []);

	const handleStatusChange = useCallback((value: string | null): void => {
		if (value !== null) setStatus(value);
	}, []);

	const handleRowClick = useCallback(
		(row: TelescopeJobLogEntry): void => {
			if (row.correlationId !== null) {
				router.push(`/telescope/requests?correlation=${encodeURIComponent(row.correlationId)}`);
			}
		},
		[router],
	);

	// Live: the API publishes a `job` frame on the SSE stream when a job
	// finishes — refetch on push so the table updates without a manual refresh.
	// Other frame types (requests/exceptions/schedules) are ignored here.
	const handleLiveEvent = useCallback(
		(event: TelescopeStreamEvent): void => {
			if (event.type === "job") void listQuery.refetch();
		},
		[listQuery],
	);
	const live = useTelescopeLive(handleLiveEvent);

	// Clicking a feed row: the shared streamEventTarget helper decides the
	// route (request detail, exceptions list, or a job's correlated request).
	const handleFeedNavigate = useCallback(
		(event: TelescopeStreamEvent): void => {
			const target: string | null = streamEventTarget(event);
			if (target !== null) router.push(target);
		},
		[router],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TelescopeJobLogEntry>[]>(
		() => [
			{
				accessorKey: "jobName",
				header: "Job",
				cell: ({ row }): React.JSX.Element => <span className="font-mono text-xs font-medium text-foreground">{row.original.jobName}</span>,
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }): React.JSX.Element => (
					<span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${jobStatusTone(row.original.status)}`}>
						<span className="size-1.5 rounded-full bg-current" />
						{row.original.status}
					</span>
				),
			},
			{
				accessorKey: "durationMs",
				header: "Duration",
				cell: ({ row }): React.JSX.Element => (
					<span className="font-mono text-xs text-muted-foreground tabular-nums">{row.original.durationMs !== null ? durationLabel(row.original.durationMs) : "—"}</span>
				),
			},
			{
				accessorKey: "payloadSize",
				header: "Payload",
				cell: ({ row }): React.JSX.Element => (
					<span className="font-mono text-xs text-muted-foreground tabular-nums">{row.original.payloadSize > 0 ? `${String(row.original.payloadSize)}B` : "—"}</span>
				),
			},
			{
				accessorKey: "enqueuedAt",
				header: "Enqueued",
				cell: ({ row }): React.JSX.Element => <span className="text-xs text-muted-foreground tabular-nums">{formatTime(row.original.enqueuedAt)}</span>,
			},
			{
				accessorKey: "error",
				header: "Error",
				cell: ({ row }): React.JSX.Element =>
					row.original.error !== null ? (
						<span className="max-w-xs truncate font-mono text-xs text-red-600 dark:text-red-400">{row.original.error}</span>
					) : (
						<span className="text-xs text-muted-foreground">—</span>
					),
			},
		],
		[],
	);

	const statusItems = useMemo(() => [{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS], []);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Jobs</h1>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						Every async task recorded through <code className="font-mono">TelescopeJobRunner</code> — wrap any job executor and it lands here with queue latency and failure
						state.
					</p>
				</div>
				<span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
					<span className={`size-1.5 animate-pulse rounded-full ${live.connected ? "bg-emerald-500" : "bg-amber-500"}`} />
					{live.paused ? "paused" : live.connected ? "live" : "reconnecting…"}
				</span>
			</header>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="tel-job-status" className="text-xs font-medium text-muted-foreground">
					Status
				</label>
				<Select value={status} onValueChange={handleStatusChange} items={statusItems}>
					<SelectTrigger id="tel-job-status" className="h-9 w-40 text-sm">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						{STATUS_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<DataTable
				data={[...rows]}
				columns={columns}
				manual
				totalCount={totalCount}
				pageSize={pageSize}
				pageSizeOptions={PAGE_SIZE_OPTIONS}
				onManualPaginationChange={handleManualPaginationChange}
				onRowClick={handleRowClick}
				exportable
				exportFilename="telescope-jobs"
				isLoading={listQuery.isLoading}
				error={listQuery.error !== null ? "Failed to load jobs." : null}
			/>

			<LiveFeedCard events={live.events} onNavigate={handleFeedNavigate} paused={live.paused} />
		</div>
	);
}
