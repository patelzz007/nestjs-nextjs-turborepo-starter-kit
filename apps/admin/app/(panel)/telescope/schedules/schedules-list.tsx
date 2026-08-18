"use client";

// ============================================
// app/(panel)/telescope/schedules/page.tsx
// Feature 4 — scheduled-task view. Every task registered through
// TelescopeSchedulerService: cron expression, last-run status/duration/error,
// and the next computed run time.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";

import { Button } from "@workspace/ui/components/form/button";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { CalendarClock, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { TelescopeScheduleLog, TelescopeSchedulesResponse, TelescopeStreamEvent } from "@workspace/shared";

import { LiveFeedCard } from "@/components/telescope/live-feed-card";
import { durationLabel, formatTime, scheduleStatusTone, streamEventTarget, timeAgo } from "@/lib/telescope";
import { useTelescopeLive } from "@/lib/use-telescope-live";

export default function TelescopeSchedulesPage(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const schedulesQuery = api.telescope.schedules.useQuery(undefined);

	const schedules: readonly TelescopeScheduleLog[] = useMemo(() => schedulesQuery.data?.data.items ?? [], [schedulesQuery.data]);
	const response: TelescopeSchedulesResponse | undefined = schedulesQuery.data?.data;

	// Live: the API publishes a `schedule` frame on the SSE stream after each
	// cron run — refetch on push so a card flips to succeeded/failed live.
	const handleLiveEvent = useCallback(
		(event: TelescopeStreamEvent): void => {
			if (event.type === "schedule") void schedulesQuery.refetch();
		},
		[schedulesQuery],
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

	if (schedulesQuery.isLoading && response === undefined) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Loading schedules…</p>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
						<CalendarClock className="size-6 text-muted-foreground" />
						Schedules
					</h1>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						Cron tasks registered via <code className="font-mono">TelescopeSchedulerService.register()</code> — last-run duration, failure state and next run.
					</p>
				</div>
				<span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
					<span className={`size-1.5 animate-pulse rounded-full ${live.connected ? "bg-emerald-500" : "bg-amber-500"}`} />
					{live.paused ? "paused" : live.connected ? "live" : "reconnecting…"}
				</span>
			</header>
			{schedules.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					No schedules registered yet. Register one with{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">telescopeScheduler.register("name", "cron", fn)</code>.
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					{schedules.map((schedule) => (
						<div key={schedule.name} className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<h2 className="truncate text-sm font-semibold">{schedule.name}</h2>
									<code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{schedule.cron}</code>
								</div>
								<div className="flex shrink-0 items-center gap-1.5">
									<span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${scheduleStatusTone(schedule.status)}`}>
										<span className="size-1.5 rounded-full bg-current" />
										{schedule.status}
									</span>
									{/* Feature 12 — run this schedule on demand. */}
									<RunNowButton name={schedule.name} onRan={(): void => void schedulesQuery.refetch()} />
								</div>
							</div>
							<div className="mt-3 grid grid-cols-2 gap-3 text-xs">
								<div>
									<p className="text-muted-foreground">Last run</p>
									<p className="mt-0.5 font-medium tabular-nums">{schedule.lastRunAt !== null ? formatTime(schedule.lastRunAt) : "never"}</p>
									{schedule.lastRunAt !== null ? <p className="text-[11px] text-muted-foreground">{timeAgo(schedule.lastRunAt)}</p> : null}
								</div>
								<div>
									<p className="text-muted-foreground">Duration</p>
									<p className="mt-0.5 font-medium tabular-nums">{schedule.lastDurationMs !== null ? durationLabel(schedule.lastDurationMs) : "—"}</p>
								</div>
								<div className="col-span-2">
									<p className="text-muted-foreground">Next run</p>
									<p className="mt-0.5 font-medium tabular-nums">{formatTime(schedule.nextRunAt)}</p>
								</div>
								{schedule.lastError !== null ? (
									<div className="col-span-2 rounded-md border border-red-300/60 bg-red-500/5 px-2 py-1.5">
										<p className="font-medium text-red-600 dark:text-red-400">Last error</p>
										<p className="mt-0.5 font-mono text-[11px] break-all text-red-600/80 dark:text-red-400/80">{schedule.lastError}</p>
									</div>
								) : null}
								{/* Improvement 20 — recent run history as a status dot row. */}
								{schedule.history.length > 0 ? (
									<div className="col-span-2">
										<p className="mb-1 text-muted-foreground">Recent runs ({String(schedule.history.length)})</p>
										<div className="flex flex-wrap items-center gap-1">
											{schedule.history.map((run) => (
												<span
													key={run.at}
													title={`${formatTime(run.at)} · ${run.status}${run.durationMs !== null ? ` · ${durationLabel(run.durationMs)}` : ""}`}
													className={`size-2 rounded-full ${run.status === "succeeded" ? "bg-emerald-500" : run.status === "failed" ? "bg-red-500" : "bg-muted-foreground/50"}`}
												/>
											))}
										</div>
									</div>
								) : null}
							</div>{" "}
						</div>
					))}
				</div>
			)}{" "}
			<LiveFeedCard events={live.events} onNavigate={handleFeedNavigate} paused={live.paused} />
		</div>
	);
}

/**
 * Feature 12 — "Run now": fires a registered schedule on demand via
 * `POST /telescope/schedules/:name/run`. The mutation id is part of the URL,
 * so this per-row component owns its mutation (rule: no hooks in a map).
 */
function RunNowButton({ name, onRan }: { readonly name: string; readonly onRan: () => void }): React.JSX.Element {
	const { api } = useAuth();
	const runMutation = api.telescope.runSchedule.useMutation();

	const handleClick = useCallback(
		(event: React.MouseEvent): void => {
			event.stopPropagation();
			runMutation.mutate(
				{ name },
				{
					onSuccess: (): void => {
						onRan();
						toastMessage.success({ title: `"${name}" ran — check the history dots.` });
					},
					onError: (): void => {
						toastMessage.error({ title: "Run failed — the task threw (see the card's last-error)." });
					},
				},
			);
		},
		[runMutation, name, onRan],
	);

	return (
		<Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={handleClick} disabled={runMutation.isPending} title={`Run "${name}" now`}>
			{runMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
			Run now
		</Button>
	);
}
