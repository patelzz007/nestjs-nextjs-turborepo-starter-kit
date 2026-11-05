import { epochMs, type EpochMs, type QueueName } from "@workspace/shared";
import type { Job, Metrics, Queue } from "bullmq";

import type { FailedJobAction, FailedJobSummary, QueueAdminPort, QueueSnapshot } from "../../application/ports/queue-admin.port";

/** What the adapter needs from one BullMQ queue (narrowed so tests can hand it a real queue or a small fake). */
export type AdministeredQueue = Pick<Queue, "getJobCounts" | "isPaused" | "getMetrics" | "getFailed" | "getFailedCount" | "getJob">;

/** BullMQ's default for a job enqueued without `attempts`. */
const DEFAULT_ATTEMPTS = 1;

const MINUTE_MS = 60_000;

/**
 * How many jobs BullMQ's metrics put in the last `windowMinutes` before `now`.
 *
 * BullMQ appends a per-minute data point only when a job finishes in a LATER minute: until then the jobs since
 * the last data point sit in a running counter (`meta.count − meta.prevCount`), and after a quiet spell the
 * stored points are older than they look. So: the pending jobs (finished in the minute of `meta.prevTS` or
 * since) count while that minute is inside the window, and data point `i` (newest first) is the minute
 * `i + 1` before it, counted only while inside the window too.
 */
export function jobsInWindow(metrics: Pick<Metrics, "meta" | "data">, now: EpochMs, windowMinutes: number): number {
	if (metrics.meta.prevTS === 0) {
		return metrics.meta.count;
	}
	const minutesSinceLastPoint = Math.floor(now / MINUTE_MS) - Math.floor(metrics.meta.prevTS / MINUTE_MS);
	if (minutesSinceLastPoint >= windowMinutes) {
		return 0;
	}
	const pending = metrics.meta.count - metrics.meta.prevCount;
	const pointsInWindow = windowMinutes - minutesSinceLastPoint - 1;
	return pending + metrics.data.slice(0, Math.max(0, pointsInWindow)).reduce((total: number, perMinute: number): number => total + perMinute, 0);
}

function summarize(job: Job): FailedJobSummary {
	return {
		id: job.id ?? "",
		name: job.name,
		failedReason: job.failedReason.length === 0 ? null : job.failedReason,
		attemptsMade: job.attemptsMade,
		maxAttempts: job.opts.attempts ?? DEFAULT_ATTEMPTS,
		createdAt: epochMs(job.timestamp),
		failedAt: job.finishedOn === undefined ? null : epochMs(job.finishedOn),
	};
}

/**
 * The queues over BullMQ: counts, BullMQ's own per-minute metrics, and the failed set. Each queue is looked up
 * when used (`queueFor`), not when this is built: Nest creates the queue providers after this factory runs.
 */
export class BullMqQueueAdmin implements QueueAdminPort {
	public readonly available = true;

	public constructor(
		private readonly names: readonly QueueName[],
		private readonly queueFor: (name: QueueName) => AdministeredQueue,
	) {}

	public async snapshots(windowMinutes: number, now: EpochMs): Promise<readonly QueueSnapshot[]> {
		const lastPoint = windowMinutes - 1;
		return Promise.all(
			this.names.map(async (name): Promise<QueueSnapshot> => {
				const queue = this.queueFor(name);
				const [counts, paused, completed, failed] = await Promise.all([
					queue.getJobCounts("waiting", "active", "delayed", "failed"),
					queue.isPaused(),
					queue.getMetrics("completed", 0, lastPoint),
					queue.getMetrics("failed", 0, lastPoint),
				]);
				return {
					name,
					waiting: counts.waiting ?? 0,
					active: counts.active ?? 0,
					delayed: counts.delayed ?? 0,
					failed: counts.failed ?? 0,
					paused,
					completedInWindow: jobsInWindow(completed, now, windowMinutes),
					failedInWindow: jobsInWindow(failed, now, windowMinutes),
				};
			}),
		);
	}

	public async failedJobs(name: QueueName, limit: number): Promise<{ readonly total: number; readonly jobs: readonly FailedJobSummary[] }> {
		const queue = this.queueFor(name);
		const [total, jobs] = await Promise.all([queue.getFailedCount(), queue.getFailed(0, limit - 1)]);
		return { total, jobs: jobs.map(summarize) };
	}

	public async retry(name: QueueName, jobId: string): Promise<FailedJobAction> {
		const job = await this.failedJob(name, jobId);
		if (job === null) {
			return "not-failed";
		}
		await job.retry("failed", { resetAttemptsMade: true });
		return "done";
	}

	public async discard(name: QueueName, jobId: string): Promise<FailedJobAction> {
		const job = await this.failedJob(name, jobId);
		if (job === null) {
			return "not-failed";
		}
		await job.remove();
		return "done";
	}

	private async failedJob(name: QueueName, jobId: string): Promise<Job | null> {
		const job: Job | undefined = await this.queueFor(name).getJob(jobId);
		return job !== undefined && (await job.isFailed()) ? job : null;
	}
}

/** Where the API runs without Redis: no queues, nothing to retry. */
export class UnavailableQueueAdmin implements QueueAdminPort {
	public readonly available = false;

	public snapshots(): Promise<readonly QueueSnapshot[]> {
		return Promise.resolve([]);
	}

	public failedJobs(): Promise<{ readonly total: number; readonly jobs: readonly FailedJobSummary[] }> {
		return Promise.resolve({ total: 0, jobs: [] });
	}

	public retry(): Promise<FailedJobAction> {
		return Promise.resolve("not-failed");
	}

	public discard(): Promise<FailedJobAction> {
		return Promise.resolve("not-failed");
	}
}
