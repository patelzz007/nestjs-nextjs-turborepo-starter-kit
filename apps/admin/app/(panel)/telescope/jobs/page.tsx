"use client";

// ============================================
// app/(panel)/telescope/jobs/page.tsx
// Feature 3 — queue/job inspection. Every task wrapped in TelescopeJobRunner
// shows up here: name, status, duration, payload size, queue latency
// (startedAt - enqueuedAt) and the correlation it ran inside.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { ExternalLink, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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

/**
 * Job-family presets — each maps to the `jobName` prefix the auto-capture
 * adapters use, so one click isolates a family (auth flows, email sends,
 * impersonation, sessions, demo). "all" = no filter.
 */
const FAMILY_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "all", label: "All families" },
	{ value: "auth:", label: "Auth" },
	{ value: "send-email:", label: "Email" },
	{ value: "impersonation:", label: "Impersonation" },
	{ value: "session:", label: "Session" },
	{ value: "demo", label: "Demo" },
];

/**
 * Improvement 17 — re-run a failed job from the UI. The runner keeps a
 * registry of job fns, so the retry endpoint spawns a NEW entry with the
 * same fn (background jobs stay retryable; jobs whose fn was never
 * registered return a 404 the mutation surfaces as a toast).
 */
function RetryAction({ job, onRetried }: { readonly job: TelescopeJobLogEntry; readonly onRetried: () => void }): React.JSX.Element {
	const { api } = useAuth();
	const retryMutation = api.procedure(telescopeEndpoints.retryJob(job.id)).useMutation();

	const handleRetry = useCallback(
		(event: React.MouseEvent): void => {
			event.stopPropagation();
			retryMutation.mutate(
				{},
				{
					onSuccess: (): void => {
						onRetried();
						toast.success("Job re-queued — a new entry will appear.");
					},
					onError: (): void => {
						toast.error("Retry failed — the job fn is not registered (API restart clears it).");
					},
				},
			);
		},
		[retryMutation, onRetried],
	);

	return (
		<Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={handleRetry} disabled={retryMutation.isPending} title="Re-run this job (new entry)">
			<RotateCcw className="size-3" />
			{retryMutation.isPending ? "Re-queueing…" : "Retry"}
		</Button>
	);
}

export default function TelescopeJobsPage(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const [status, setStatus] = useState<string>("all");
	// Feature 11 — job name substring filter.
	const [jobName, setJobName] = useState<string>("");
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(20);
	// Feature 11 — clicking a row opens a detail drawer.
	const [selected, setSelected] = useState<TelescopeJobLogEntry | null>(null);

	const query: TelescopeJobsListQuery = useMemo((): TelescopeJobsListQuery => {
		const draft: Record<string, string | number> = { page, pageSize };
		if (status !== "all") draft.status = status;
		if (jobName.trim().length > 0) draft.jobName = jobName.trim();
		return TelescopeJobsListQuerySchema.parse(draft);
	}, [page, pageSize, status, jobName]);

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

	// The family select mirrors the free-text `jobName` input: picking a
	// preset fills the input with that prefix (which the API substring-matches),
	// and editing the text drops the select back to "all".
	const activeFamily: string = FAMILY_OPTIONS.some((option) => option.value !== "all" && jobName === option.value) ? jobName : "all";
	const handleFamilyChange = useCallback((value: string | null): void => {
		if (value !== null) setJobName(value === "all" ? "" : value);
	}, []);

	// Feature 11 — row click opens the detail drawer (not a hard redirect).
	const handleRowClick = useCallback((row: TelescopeJobLogEntry): void => {
		setSelected(row);
	}, []);

	const handleCloseDrawer = useCallback((): void => {
		setSelected(null);
	}, []);

	const handleJobNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setJobName(event.target.value);
	}, []);

	// Improvement 17 — after a retry, refetch so the new entry shows up.
	const refreshList = useCallback((): void => {
		void listQuery.refetch();
	}, [listQuery]);

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
			{
				// Improvement 17 — re-run a failed job straight from the table.
				id: "retry",
				header: "",
				cell: ({ row }): React.JSX.Element =>
					row.original.status === "failed" ? <RetryAction job={row.original} onRetried={refreshList} /> : <span className="text-xs text-muted-foreground">—</span>,
			},
		],
		[refreshList],
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

			<div className="flex flex-wrap items-end gap-3">
				{/* Feature 11 — job name substring filter. */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-job-name" className="text-xs font-medium text-muted-foreground">
						Job name
					</label>
					<Input id="tel-job-name" type="search" placeholder="e.g. send-email" value={jobName} onChange={handleJobNameChange} className="h-9 w-48 text-sm" />
				</div>{" "}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-job-family" className="text-xs font-medium text-muted-foreground">
						Family
					</label>
					<Select value={activeFamily} onValueChange={handleFamilyChange} items={FAMILY_OPTIONS}>
						<SelectTrigger id="tel-job-family" className="h-9 w-40 text-sm">
							<SelectValue placeholder="Family" />
						</SelectTrigger>
						<SelectContent>
							{FAMILY_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
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

			{/* Feature 11 — job detail drawer. */}
			{selected !== null ? <JobDetailDrawer job={selected} onClose={handleCloseDrawer} onRetried={refreshList} /> : null}
		</div>
	);
}

/**
 * Feature 11 — job detail drawer. Full timestamps (enqueued/started/finished,
 * queue latency), payload size, error, and a correlation link into the
 * originating request. Row click opens this instead of a hard redirect.
 */
function JobDetailDrawer({
	job,
	onClose,
	onRetried,
}: {
	readonly job: TelescopeJobLogEntry;
	readonly onClose: () => void;
	readonly onRetried: () => void;
}): React.JSX.Element {
	const router = useRouter();
	const queueLatencyMs: number | null = job.startedAt !== null ? Math.max(0, job.startedAt - job.enqueuedAt) : null;

	const handleViewRequest = useCallback((): void => {
		if (job.correlationId !== null) {
			router.push(`/telescope/requests?correlation=${encodeURIComponent(job.correlationId)}`);
		}
	}, [router, job.correlationId]);

	return (
		<div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Job detail">
			<button type="button" aria-label="Close" className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
			<div className="relative flex h-full w-full max-w-lg flex-col border-l bg-card shadow-xl">
				<div className="flex items-center justify-between gap-2 border-b px-4 py-3">
					<div className="min-w-0">
						<h2 className="truncate text-sm font-semibold">{job.jobName}</h2>
						<p className="text-xs text-muted-foreground">
							<span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-xs font-medium capitalize ${jobStatusTone(job.status)}`}>
								<span className="size-1 rounded-full bg-current" />
								{job.status}
							</span>
						</p>
					</div>
					<div className="flex items-center gap-1">
						{job.correlationId !== null ? (
							<Button variant="outline" size="sm" onClick={handleViewRequest}>
								<ExternalLink className="size-3.5" />
								View request
							</Button>
						) : null}
						{job.status === "failed" ? <RetryAction job={job} onRetried={onRetried} /> : null}
						<Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
							<X className="size-4" />
						</Button>
					</div>
				</div>
				<div className="flex-1 space-y-4 overflow-y-auto p-4">
					<div className="grid grid-cols-2 gap-3">
						<Stat label="Duration" value={job.durationMs !== null ? durationLabel(job.durationMs) : "—"} />
						<Stat label="Queue latency" value={queueLatencyMs !== null ? durationLabel(queueLatencyMs) : "—"} />
						<Stat label="Payload size" value={job.payloadSize > 0 ? `${String(job.payloadSize)}B` : "—"} />
						<Stat label="Correlation" value={job.correlationId ?? "—"} mono />
					</div>
					<div>
						<h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Timeline</h3>
						<div className="space-y-1 rounded-lg border p-3 font-mono text-xs">
							<p className="flex justify-between gap-2">
								<span className="text-muted-foreground">Enqueued</span>
								<span>{formatTime(job.enqueuedAt)}</span>
							</p>
							<p className="flex justify-between gap-2">
								<span className="text-muted-foreground">Started</span>
								<span>{job.startedAt !== null ? formatTime(job.startedAt) : "—"}</span>
							</p>
							<p className="flex justify-between gap-2">
								<span className="text-muted-foreground">Finished</span>
								<span>{job.finishedAt !== null ? formatTime(job.finishedAt) : "—"}</span>
							</p>
						</div>
					</div>
					{job.error !== null ? (
						<div>
							<h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Error</h3>
							<pre className="overflow-auto rounded-lg bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap text-red-600 dark:text-red-400">{job.error}</pre>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

/** One label/value stat inside the job drawer. */
function Stat({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }): React.JSX.Element {
	return (
		<div className="rounded-lg border p-2.5">
			<p className="text-[11px] text-muted-foreground">{label}</p>
			<p className={`mt-0.5 truncate text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
		</div>
	);
}
