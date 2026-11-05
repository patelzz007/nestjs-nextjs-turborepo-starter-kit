import type { EpochMs, QueueName } from "@workspace/shared";

/** One queue's counts and the last window's finished jobs (BullMQ's per-minute metrics). */
export interface QueueSnapshot {
	readonly name: QueueName;
	readonly waiting: number;
	readonly active: number;
	readonly delayed: number;
	readonly failed: number;
	readonly paused: boolean;
	readonly completedInWindow: number;
	readonly failedInWindow: number;
}

/** A failed job without its data (it can carry personal data). */
export interface FailedJobSummary {
	readonly id: string;
	readonly name: string;
	readonly failedReason: string | null;
	readonly attemptsMade: number;
	readonly maxAttempts: number;
	readonly createdAt: EpochMs;
	readonly failedAt: EpochMs | null;
}

/** What happened to a retry or discard: done, or there is no such failed job. */
export type FailedJobAction = "done" | "not-failed";

/**
 * The background job queues as an operator sees them (enhancement 4.4). Implemented over BullMQ; where the
 * API runs without Redis there are no queues (`available` is false and every read is empty).
 */
export interface QueueAdminPort {
	readonly available: boolean;
	/** Every queue, with the jobs finished in the `windowMinutes` before `now`. */
	snapshots(windowMinutes: number, now: EpochMs): Promise<readonly QueueSnapshot[]>;
	failedJobs(queue: QueueName, limit: number): Promise<{ readonly total: number; readonly jobs: readonly FailedJobSummary[] }>;
	/** Moves a failed job back to waiting, attempts reset. */
	retry(queue: QueueName, jobId: string): Promise<FailedJobAction>;
	/** Removes a failed job for good. */
	discard(queue: QueueName, jobId: string): Promise<FailedJobAction>;
}

export const QUEUE_ADMIN = Symbol("QUEUE_ADMIN");
