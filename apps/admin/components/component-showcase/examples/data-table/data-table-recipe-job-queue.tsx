"use client";

import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { DataTable, type DataTableColumns, type DataTableDetail, type DataTableRowAction } from "@workspace/ui/components/data-table";
import { Progress, ProgressIndicator, ProgressTrack } from "@workspace/ui/components/progress";

type JobState = "queued" | "running" | "done" | "failed";

/** One background job. */
interface Job {
	readonly id: string;
	readonly name: string;
	readonly queue: string;
	readonly state: JobState;
	/** Work done, 0..100. */
	readonly progress: number;
	readonly attempts: number;
	/** What happened, newest last. */
	readonly log: readonly string[];
}

export const INITIAL_JOBS: readonly Job[] = [
	{ id: "j-1", name: "Export orders (November)", queue: "exports", state: "running", progress: 35, attempts: 1, log: ["Queued", "Started on worker-2"] },
	{ id: "j-2", name: "Resize product images", queue: "media", state: "running", progress: 70, attempts: 1, log: ["Queued", "Started on worker-1"] },
	{ id: "j-3", name: "Send weekly digest", queue: "email", state: "queued", progress: 0, attempts: 0, log: ["Queued"] },
	{ id: "j-4", name: "Rebuild search index", queue: "search", state: "failed", progress: 52, attempts: 3, log: ["Queued", "Started on worker-3", "Out of memory at 52%"] },
	{ id: "j-5", name: "Sync payouts", queue: "payments", state: "done", progress: 100, attempts: 1, log: ["Queued", "Started on worker-1", "Finished"] },
];

const PROGRESS_DONE = 100;
/** How much a running job advances per tick. */
const PROGRESS_STEP = 5;
export const JOB_TICK_MS = 1000;

/** One tick of the queue: running jobs advance and finish at 100, and the first queued job starts once none is running. */
export function advanceJobs(jobs: readonly Job[]): Job[] {
	const anyRunning = jobs.some((job) => job.state === "running");
	const firstQueued = anyRunning ? undefined : jobs.find((job) => job.state === "queued")?.id;
	return jobs.map((job): Job => {
		if (job.id === firstQueued) {
			return { ...job, state: "running", attempts: job.attempts + 1, log: [...job.log, "Started on worker-1"] };
		}
		if (job.state !== "running") {
			return job;
		}
		const progress = Math.min(PROGRESS_DONE, job.progress + PROGRESS_STEP);
		return progress === PROGRESS_DONE ? { ...job, progress, state: "done", log: [...job.log, "Finished"] } : { ...job, progress };
	});
}

/** Puts a failed job back in the queue from the start. */
export function retryJob(jobs: readonly Job[], id: string): Job[] {
	return jobs.map((job): Job => (job.id === id && job.state === "failed" ? { ...job, state: "queued", progress: 0, log: [...job.log, "Retried"] } : job));
}

const STATE_BADGE: Readonly<Record<JobState, { readonly label: string; readonly variant: "info-light" | "warning-light" | "success-light" | "destructive-light" }>> = {
	queued: { label: "Queued", variant: "warning-light" },
	running: { label: "Running", variant: "info-light" },
	done: { label: "Done", variant: "success-light" },
	failed: { label: "Failed", variant: "destructive-light" },
};

/** Only a failed job can be retried. */
export function isJobFailed(job: Job): boolean {
	return job.state === "failed";
}

function getJobId(job: Job): string {
	return job.id;
}

const COLUMNS: DataTableColumns<Job> = [
	{ accessorKey: "name", header: "Job", size: 230 },
	{ accessorKey: "queue", header: "Queue", size: 110, meta: { cellClassName: "font-mono text-xs" } },
	{
		accessorKey: "state",
		header: "Status",
		size: 110,
		cell: ({ row }): React.JSX.Element => {
			const badge = STATE_BADGE[row.original.state];
			return <Badge variant={badge.variant}>{badge.label}</Badge>;
		},
	},
	{
		accessorKey: "progress",
		header: "Progress",
		size: 200,
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-2">
				<Progress value={row.original.progress} className="flex-1" aria-label={`${row.original.name} progress`}>
					<ProgressTrack>
						<ProgressIndicator className={row.original.state === "failed" ? "bg-destructive" : undefined} />
					</ProgressTrack>
				</Progress>
				<span className="w-10 text-end text-xs text-muted-foreground tabular-nums">{row.original.progress}%</span>
			</div>
		),
	},
	{ accessorKey: "attempts", header: "Attempts", size: 100, meta: { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" } },
];

function renderJobLog(job: Job): React.JSX.Element {
	return (
		<ol className="grid gap-1 text-sm">
			{job.log.map((entry, index) => (
				// The log only grows at the end, so an entry's position is a stable key.
				<li key={`${job.id}-${String(index)}`} className="flex gap-2">
					<span className="w-6 text-end text-muted-foreground tabular-nums">{index + 1}.</span>
					<span>{entry}</span>
				</li>
			))}
		</ol>
	);
}

const DETAIL: DataTableDetail<Job> = { render: renderJobLog };

/**
 * Recipe: a job queue. A timer advances running jobs and starts the next queued one; each row expands to the job's
 * log, and a failed job's Retry (an inline row action) puts it back in the queue.
 */
export function DataTableRecipeJobQueue(): React.JSX.Element {
	const [jobs, setJobs] = React.useState<readonly Job[]>(INITIAL_JOBS);

	React.useEffect((): (() => void) => {
		const timer = window.setInterval((): void => {
			setJobs(advanceJobs);
		}, JOB_TICK_MS);
		return (): void => {
			window.clearInterval(timer);
		};
	}, []);

	const rowActions = React.useMemo(
		(): readonly DataTableRowAction<Job>[] => [
			{
				key: "retry",
				label: "Retry",
				description: "Run the failed job again",
				inline: true,
				isAvailable: isJobFailed,
				onSelect: (job: Job): void => {
					setJobs((current) => retryJob(current, job.id));
				},
			},
		],
		[],
	);

	return <DataTable data={jobs} columns={COLUMNS} getRowId={getJobId} detail={DETAIL} rowActions={rowActions} />;
}
