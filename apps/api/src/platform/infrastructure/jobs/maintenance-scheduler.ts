import type { Logger } from "@nestjs/common";
import { hasLegacyRepeatableKeyShape, type Job, type JobSchedulerJson, type JobType, type Queue } from "bullmq";

import { QUEUE_JOB_OPTIONS } from "@workspace/shared";

/** The job states scanned for leftovers of the pre-`upsertJobScheduler` repeatable API. */
const LEGACY_SCAN_STATES: JobType[] = ["delayed", "waiting", "active", "failed"];
/** Upper bound of jobs inspected per boot (index range is inclusive, so 0..499 = 500). */
const LEGACY_SCAN_LAST_INDEX = 499;

/** The job fields the legacy scan reads (and the one call it makes). */
export type QueuedJob = Pick<Job, "id" | "repeatJobKey" | "timestamp" | "remove">;

/**
 * The queue capabilities a maintenance scheduler needs. A BullMQ `Queue`
 * satisfies it; tests pass a fake, so no Redis is needed.
 */
export interface MaintenanceSchedulerQueue {
	readonly getJobSchedulers: (start: number, end: number, asc: boolean) => Promise<readonly Pick<JobSchedulerJson, "key">[]>;
	readonly removeJobScheduler: (key: string) => Promise<boolean>;
	readonly getJobs: (types: JobType[], start: number, end: number) => Promise<readonly QueuedJob[]>;
	readonly upsertJobScheduler: Queue["upsertJobScheduler"];
}

/** One periodic maintenance job: a fixed scheduler id, an interval and the job it emits. */
export interface MaintenanceSchedulerDefinition<TData extends object> {
	readonly queueName: string;
	readonly schedulerId: string;
	readonly everyMs: number;
	readonly jobName: string;
	readonly data: TData;
}

/**
 * Register (or update) a periodic maintenance job scheduler.
 *
 * 1. Removes leftovers of BullMQ's LEGACY repeatable-job API only: schedulers
 *    and jobs whose key has the legacy `name:id:…` shape, and jobs with a
 *    corrupt (non-positive) timestamp. The CURRENT scheduler's own iterations
 *    (`repeat:<schedulerId>:<millis>` — the next delayed run, retained failed
 *    runs) are never touched: they are not stale.
 * 2. Upserts the scheduler with the `maintenance` preset, whose
 *    `removeOnComplete` / `removeOnFail` bound how many finished runs Redis
 *    keeps. Without them every tick (every few seconds for the outbox) is kept
 *    forever and Redis grows without bound.
 *
 * `upsertJobScheduler` is keyed by the fixed id, so every API instance may call
 * this at boot and there is still exactly one scheduler cluster-wide. Logs
 * only what it actually removed.
 */
export async function registerMaintenanceScheduler<TData extends object>(
	queue: MaintenanceSchedulerQueue,
	definition: MaintenanceSchedulerDefinition<TData>,
	logger: Pick<Logger, "log" | "warn">,
): Promise<void> {
	await removeLegacyRepeatables(queue, definition.queueName, logger);
	await queue.upsertJobScheduler(
		definition.schedulerId,
		{ every: definition.everyMs },
		{ name: definition.jobName, data: definition.data, opts: { ...QUEUE_JOB_OPTIONS.maintenance } },
	);
}

async function removeLegacyRepeatables(queue: MaintenanceSchedulerQueue, queueName: string, logger: Pick<Logger, "log" | "warn">): Promise<void> {
	const schedulers = await queue.getJobSchedulers(0, -1, true);
	for (const scheduler of schedulers) {
		if (!hasLegacyRepeatableKeyShape(scheduler.key)) {
			continue;
		}
		try {
			await queue.removeJobScheduler(scheduler.key);
			logger.log(`Removed legacy repeatable scheduler ${scheduler.key} from ${queueName}`);
		} catch (error) {
			logger.warn(`Could not remove legacy repeatable scheduler ${scheduler.key} from ${queueName}: ${String(error)}`);
		}
	}

	const jobs = await queue.getJobs(LEGACY_SCAN_STATES, 0, LEGACY_SCAN_LAST_INDEX);
	for (const job of jobs) {
		const isLegacyRepeat = job.repeatJobKey !== undefined && hasLegacyRepeatableKeyShape(job.repeatJobKey);
		const isCorruptTimestamp = job.timestamp <= 0;
		if (!isLegacyRepeat && !isCorruptTimestamp) {
			continue;
		}
		try {
			await job.remove();
			logger.log(`Removed legacy job ${String(job.id)} from ${queueName}`);
		} catch (error) {
			logger.warn(`Could not remove legacy job ${String(job.id)} from ${queueName}: ${String(error)}`);
		}
	}
}
