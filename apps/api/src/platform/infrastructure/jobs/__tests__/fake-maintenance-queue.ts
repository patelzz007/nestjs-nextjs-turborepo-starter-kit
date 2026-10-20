import type { Queue } from "bullmq";
import { vi } from "vitest";

import type { MaintenanceSchedulerQueue, QueuedJob } from "../maintenance-scheduler";

/** A maintenance queue with no legacy leftovers whose `upsertJobScheduler` is a spy (no Redis). */
export interface FakeMaintenanceQueue extends MaintenanceSchedulerQueue {
	readonly upsertJobScheduler: ReturnType<typeof vi.fn<Queue["upsertJobScheduler"]>>;
}

export function fakeMaintenanceQueue(): FakeMaintenanceQueue {
	return {
		getJobSchedulers: () => Promise.resolve([]),
		removeJobScheduler: () => Promise.resolve(true),
		getJobs: (): Promise<readonly QueuedJob[]> => Promise.resolve([]),
		upsertJobScheduler: vi.fn<Queue["upsertJobScheduler"]>(),
	};
}
