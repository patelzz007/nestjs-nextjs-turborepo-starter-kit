"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { OpsQueueJobActionSchema, PERMISSION, type OpsFailedJob, type OpsQueue, type QueueName } from "@workspace/shared";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";

import { formatDateTimeShort } from "../lib/ops-format";

/** How often the numbers refresh while the page is open. */
const QUEUES_REFRESH_MS = 10_000;
/** A failure rate at or above this reads as a problem. */
const FAILURE_RATE_DANGER_PERCENT = 10;

/** A failure rate as people read it ("12.5%"), or a dash when nothing finished. */
export function formatFailureRate(percent: number | null): string {
	return percent === null ? "—" : `${String(percent)}%`;
}

function failureTone(queue: OpsQueue): StatusTone {
	if (queue.failureRatePercent === null || queue.failureRatePercent === 0) {
		return "neutral";
	}
	return queue.failureRatePercent >= FAILURE_RATE_DANGER_PERCENT ? "danger" : "warning";
}

/** `/operations/queues` (enhancement 4.4): every background job queue, its failures, and retry or discard. */
export function QueuesView(): React.JSX.Element {
	const { api } = useAuth();
	const list = api.operations.queues.useQuery(undefined, { refetchInterval: QUEUES_REFRESH_MS });
	const data = list.data?.data;
	const [selected, setSelected] = React.useState<QueueName | null>(null);

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">Queues</h1>
				<p className="text-sm text-muted-foreground">
					Background jobs (emails, notifications, backups, clean-ups): what is waiting, what failed, and running a failed job again.
				</p>
			</header>
			{data === undefined ? (
				<Skeleton className="h-64 w-full rounded-xl" />
			) : !data.available ? (
				<Alert>
					<AlertTitle>No queues here</AlertTitle>
					<AlertDescription>This API runs without Redis, so background jobs run inline and there is nothing to show. Set REDIS_URL to use queues.</AlertDescription>
				</Alert>
			) : (
				<QueuesTable queues={data.queues} windowMinutes={data.metricsWindowMinutes} selected={selected} onSelect={setSelected} />
			)}
			{selected === null ? null : <FailedJobsCard queue={selected} />}
		</div>
	);
}

function QueuesTable({
	queues,
	windowMinutes,
	selected,
	onSelect,
}: {
	readonly queues: readonly OpsQueue[];
	readonly windowMinutes: number;
	readonly selected: QueueName | null;
	readonly onSelect: (queue: QueueName) => void;
}): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Every queue</CardTitle>
				<CardDescription>Failure rate over the last {windowMinutes} minutes: failed jobs out of every job that finished.</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				<Table aria-label="Queues">
					<TableHeader>
						<TableRow>
							<TableHead>Queue</TableHead>
							<TableHead className="text-end">Waiting</TableHead>
							<TableHead className="text-end">Running</TableHead>
							<TableHead className="text-end">Delayed</TableHead>
							<TableHead className="text-end">Failed</TableHead>
							<TableHead className="text-end">Last hour</TableHead>
							<TableHead className="text-end">Failure rate</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{queues.map((queue): React.JSX.Element => (
							<QueueRow key={queue.name} queue={queue} isSelected={selected === queue.name} onSelect={onSelect} />
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

function QueueRow({
	queue,
	isSelected,
	onSelect,
}: {
	readonly queue: OpsQueue;
	readonly isSelected: boolean;
	readonly onSelect: (queue: QueueName) => void;
}): React.JSX.Element {
	const handleSelect = React.useCallback((): void => {
		onSelect(queue.name);
	}, [onSelect, queue.name]);
	return (
		<TableRow aria-selected={isSelected}>
			<TableCell>
				<span className="font-medium">{queue.name}</span>
				{queue.paused ? (
					<StatusBadge className="ms-2" tone="warning">
						Paused
					</StatusBadge>
				) : null}
			</TableCell>
			<TableCell className="text-end tabular-nums">{queue.waiting}</TableCell>
			<TableCell className="text-end tabular-nums">{queue.active}</TableCell>
			<TableCell className="text-end tabular-nums">{queue.delayed}</TableCell>
			<TableCell className="text-end tabular-nums">{queue.failed}</TableCell>
			<TableCell className="text-end text-muted-foreground tabular-nums">
				{queue.completedLastHour} done, {queue.failedLastHour} failed
			</TableCell>
			<TableCell className="text-end">
				<StatusBadge tone={failureTone(queue)}>{formatFailureRate(queue.failureRatePercent)}</StatusBadge>
			</TableCell>
			<TableCell className="text-end">
				<Button
					type="button"
					size="sm"
					variant={isSelected ? "secondary" : "outline"}
					disabled={queue.failed === 0}
					onClick={handleSelect}
					aria-label={`Failed jobs in ${queue.name}`}>
					Failed jobs
				</Button>
			</TableCell>
		</TableRow>
	);
}

type JobAction = "retry" | "discard";

function useJobAction(queue: QueueName): { readonly act: (action: JobAction, jobId: string, reason: string) => void; readonly isPending: boolean } {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const refresh = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.operations.queues.queryKey(undefined) });
		await queryClient.invalidateQueries({ queryKey: apiRouter.operations.queueFailedJobs.queryKey({ queueName: queue }) });
	}, [queryClient, queue]);
	const retry = api.operations.retryQueueJob.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Job queued again", description: "It runs again with its attempts reset." });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not retry the job", error);
		},
	});
	const discard = api.operations.discardQueueJob.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Job discarded" });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not discard the job", error);
		},
	});
	const { mutate: mutateRetry } = retry;
	const { mutate: mutateDiscard } = discard;
	const act = React.useCallback(
		(action: JobAction, jobId: string, reason: string): void => {
			const input = { queueName: queue, jobId, reason };
			if (action === "retry") {
				mutateRetry(input);
			} else {
				mutateDiscard(input);
			}
		},
		[mutateDiscard, mutateRetry, queue],
	);
	return { act, isPending: retry.isPending || discard.isPending };
}

/** One queue's failed jobs (never their data: it can hold personal data), with retry and discard. */
export function FailedJobsCard({ queue }: { readonly queue: QueueName }): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const failed = api.operations.queueFailedJobs.useQuery({ queueName: queue });
	const list = failed.data?.data;
	const { act, isPending } = useJobAction(queue);
	const [reason, setReason] = React.useState("");
	const reasonValid = OpsQueueJobActionSchema.safeParse({ reason }).success;
	/** A retry or discard needs a reason, and one change at a time. */
	const actionsEnabled: boolean = reasonValid && !isPending;
	const canRetry = can(PERMISSION.BACKGROUND_JOB.UPDATE);
	const canDiscard = can(PERMISSION.BACKGROUND_JOB.DELETE);
	const reasonId = React.useId();
	const handleReason = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setReason(event.currentTarget.value);
	}, []);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Failed jobs in {queue}</CardTitle>
				<CardDescription>
					{list === undefined
						? "Loading…"
						: list.total > list.jobs.length
							? `The newest ${String(list.jobs.length)} of ${String(list.total)}.`
							: `${String(list.total)} failed.`}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{canRetry || canDiscard ? (
					<div className="flex max-w-xl flex-col gap-1.5">
						<Label htmlFor={reasonId}>Why (kept in the audit log)</Label>
						<Input id={reasonId} value={reason} onChange={handleReason} placeholder="e.g. The mail provider is back; send again" />
					</div>
				) : null}
				{list === undefined ? (
					<Skeleton className="h-32 w-full rounded-xl" />
				) : list.jobs.length === 0 ? (
					<p className="text-sm text-muted-foreground">No failed jobs left in this queue.</p>
				) : (
					<div className="overflow-x-auto">
						<Table aria-label={`Failed jobs in ${queue}`}>
							<TableHeader>
								<TableRow>
									<TableHead>Job</TableHead>
									<TableHead>Why it failed</TableHead>
									<TableHead className="text-end">Attempts</TableHead>
									<TableHead>Failed</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{list.jobs.map((job): React.JSX.Element => (
									<FailedJobRow key={job.id} job={job} reason={reason} actionsEnabled={actionsEnabled} canRetry={canRetry} canDiscard={canDiscard} onAct={act} />
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function FailedJobRow({
	job,
	reason,
	actionsEnabled,
	canRetry,
	canDiscard,
	onAct,
}: {
	readonly job: OpsFailedJob;
	readonly reason: string;
	readonly actionsEnabled: boolean;
	readonly canRetry: boolean;
	readonly canDiscard: boolean;
	readonly onAct: (action: JobAction, jobId: string, reason: string) => void;
}): React.JSX.Element {
	const handleRetry = React.useCallback((): void => {
		onAct("retry", job.id, reason);
	}, [job.id, onAct, reason]);
	const handleDiscard = React.useCallback((): void => {
		onAct("discard", job.id, reason);
	}, [job.id, onAct, reason]);
	return (
		<TableRow>
			<TableCell>
				<span className="font-medium">{job.name}</span>
				<span className="ms-2 font-mono text-xs text-muted-foreground">{job.id}</span>
			</TableCell>
			<TableCell className="max-w-md">
				<p className="line-clamp-3 text-sm break-words whitespace-pre-wrap">{job.failedReason ?? "No reason recorded"}</p>
			</TableCell>
			<TableCell className="text-end tabular-nums">
				{job.attemptsMade} of {job.maxAttempts}
			</TableCell>
			<TableCell className="whitespace-nowrap">{job.failedAt === null ? "—" : formatDateTimeShort(job.failedAt)}</TableCell>
			<TableCell className="text-end whitespace-nowrap">
				{canRetry ? (
					<Button type="button" size="sm" variant="outline" disabled={!actionsEnabled} onClick={handleRetry} aria-label={`Retry job ${job.id}`}>
						Retry
					</Button>
				) : null}
				{canDiscard ? (
					<Button type="button" size="sm" variant="ghost" className="ms-2" disabled={!actionsEnabled} onClick={handleDiscard} aria-label={`Discard job ${job.id}`}>
						Discard
					</Button>
				) : null}
			</TableCell>
		</TableRow>
	);
}
