import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { QUEUE_JOB_OPTIONS } from "@workspace/shared";

import { registerMaintenanceScheduler, type MaintenanceSchedulerQueue, type QueuedJob } from "./maintenance-scheduler";

const SCHEDULER_ID = "outbox-publish";
const QUEUE_NAME = "outbox.publish";
const EVERY_MS = 5_000;
const NOW_EPOCH_MS = 1_790_837_041_825;
/** A legacy (pre-`upsertJobScheduler`) repeatable key: `name:id:endDate:tz:every`. */
const LEGACY_KEY = "sweep::::5000";

interface FakeJob extends QueuedJob {
	readonly remove: ReturnType<typeof vi.fn<QueuedJob["remove"]>>;
}

function job(id: string, repeatJobKey: string | undefined, timestamp: number = NOW_EPOCH_MS): FakeJob {
	// BullMQ types `repeatJobKey` as optional: omit the key rather than set it to undefined (ADR 018).
	return { id, ...(repeatJobKey === undefined ? {} : { repeatJobKey }), timestamp, remove: vi.fn<QueuedJob["remove"]>(() => Promise.resolve()) };
}

interface FakeQueue extends MaintenanceSchedulerQueue {
	readonly removeJobScheduler: ReturnType<typeof vi.fn<MaintenanceSchedulerQueue["removeJobScheduler"]>>;
	readonly upsertJobScheduler: ReturnType<typeof vi.fn<Queue["upsertJobScheduler"]>>;
}

function queueWith(schedulerKeys: readonly string[], jobs: readonly FakeJob[]): FakeQueue {
	return {
		getJobSchedulers: vi.fn<MaintenanceSchedulerQueue["getJobSchedulers"]>(() => Promise.resolve(schedulerKeys.map((key: string) => ({ key })))),
		removeJobScheduler: vi.fn<MaintenanceSchedulerQueue["removeJobScheduler"]>(() => Promise.resolve(true)),
		getJobs: vi.fn<MaintenanceSchedulerQueue["getJobs"]>(() => Promise.resolve(jobs)),
		upsertJobScheduler: vi.fn<Queue["upsertJobScheduler"]>(),
	};
}

function fakeLogger(): { log: ReturnType<typeof vi.fn<(message: string) => void>>; warn: ReturnType<typeof vi.fn<(message: string) => void>> } {
	return { log: vi.fn<(message: string) => void>(), warn: vi.fn<(message: string) => void>() };
}

const DEFINITION = { queueName: QUEUE_NAME, schedulerId: SCHEDULER_ID, everyMs: EVERY_MS, jobName: "sweep", data: {} };

describe("registerMaintenanceScheduler", () => {
	it("upserts the scheduler with the maintenance preset, so finished runs are bounded in Redis", async () => {
		const queue = queueWith([SCHEDULER_ID], []);

		await registerMaintenanceScheduler(queue, DEFINITION, fakeLogger());

		expect(queue.upsertJobScheduler).toHaveBeenCalledExactlyOnceWith(SCHEDULER_ID, { every: EVERY_MS }, { name: "sweep", data: {}, opts: QUEUE_JOB_OPTIONS.maintenance });
		expect(QUEUE_JOB_OPTIONS.maintenance.removeOnComplete).toBeGreaterThan(0);
		expect(QUEUE_JOB_OPTIONS.maintenance.removeOnFail).toBeGreaterThan(0);
	});

	it("leaves the current scheduler and its own iterations alone, and logs nothing", async () => {
		const nextRun = job(`repeat:${SCHEDULER_ID}:1790837046790`, SCHEDULER_ID);
		const retainedFailure = job(`repeat:${SCHEDULER_ID}:1790835026790`, SCHEDULER_ID);
		const queue = queueWith([SCHEDULER_ID], [nextRun, retainedFailure]);
		const logger = fakeLogger();

		await registerMaintenanceScheduler(queue, DEFINITION, logger);

		expect(queue.removeJobScheduler).not.toHaveBeenCalled();
		expect(nextRun.remove).not.toHaveBeenCalled();
		expect(retainedFailure.remove).not.toHaveBeenCalled();
		expect(logger.log).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it("removes legacy repeatable schedulers and jobs, and jobs with a corrupt timestamp", async () => {
		const legacyJob = job("repeat:abc:1", LEGACY_KEY);
		const corruptJob = job("manual-1", undefined, 0);
		const ordinaryJob = job("manual-2", undefined);
		const queue = queueWith([LEGACY_KEY, SCHEDULER_ID], [legacyJob, corruptJob, ordinaryJob]);
		const logger = fakeLogger();

		await registerMaintenanceScheduler(queue, DEFINITION, logger);

		expect(queue.removeJobScheduler).toHaveBeenCalledExactlyOnceWith(LEGACY_KEY);
		expect(legacyJob.remove).toHaveBeenCalledOnce();
		expect(corruptJob.remove).toHaveBeenCalledOnce();
		expect(ordinaryJob.remove).not.toHaveBeenCalled();
		expect(logger.log).toHaveBeenCalledTimes(3);
	});

	it("warns and carries on when a legacy entry cannot be removed", async () => {
		const legacyJob = job("repeat:abc:1", LEGACY_KEY);
		legacyJob.remove.mockRejectedValueOnce(new Error("locked"));
		const queue = queueWith([LEGACY_KEY], [legacyJob]);
		queue.removeJobScheduler.mockRejectedValueOnce(new Error("gone"));
		const logger = fakeLogger();

		await registerMaintenanceScheduler(queue, DEFINITION, logger);

		expect(logger.warn).toHaveBeenCalledTimes(2);
		expect(queue.upsertJobScheduler).toHaveBeenCalledOnce();
	});
});
