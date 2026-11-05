import {
	OPS_PERCENT_MAX,
	OPS_QUEUE_FAILED_JOBS_SHOWN,
	OPS_QUEUE_METRICS_MINUTES,
	type OpsFailedJobList,
	type OpsQueue,
	type OpsQueueList,
	type QueueName,
} from "@workspace/shared";

import type { Clock } from "../../../../platform/application/clock.port";
import { OpsQueueJobNotFoundError } from "../../domain/errors/operations.errors";
import type { QueueAdminPort, QueueSnapshot } from "../ports/queue-admin.port";

/** Failed ÷ finished as a percentage with one decimal; null when nothing finished. */
export function failureRatePercent(completed: number, failed: number): number | null {
	const finished = completed + failed;
	if (finished === 0) {
		return null;
	}
	const TENTHS = 10;
	return Math.round((failed / finished) * OPS_PERCENT_MAX * TENTHS) / TENTHS;
}

function toQueue(snapshot: QueueSnapshot): OpsQueue {
	return {
		name: snapshot.name,
		waiting: snapshot.waiting,
		active: snapshot.active,
		delayed: snapshot.delayed,
		failed: snapshot.failed,
		paused: snapshot.paused,
		completedLastHour: snapshot.completedInWindow,
		failedLastHour: snapshot.failedInWindow,
		failureRatePercent: failureRatePercent(snapshot.completedInWindow, snapshot.failedInWindow),
	};
}

/**
 * The operations console's Queues screen (enhancement 4.4): every queue's depth and last-hour failure rate,
 * its failed jobs, and retry or discard of one failed job. Each change is a state-changing request with a
 * reason, so the request audit records who did it and why; only a job that is still failed can be acted on.
 */
export class OperationsQueuesService {
	public constructor(
		private readonly queues: QueueAdminPort,
		private readonly clock: Clock,
	) {}

	public async list(): Promise<OpsQueueList> {
		const snapshots = await this.queues.snapshots(OPS_QUEUE_METRICS_MINUTES, this.clock.now());
		return { available: this.queues.available, metricsWindowMinutes: OPS_QUEUE_METRICS_MINUTES, queues: snapshots.map(toQueue) };
	}

	public async failedJobs(queue: QueueName): Promise<OpsFailedJobList> {
		const { total, jobs } = await this.queues.failedJobs(queue, OPS_QUEUE_FAILED_JOBS_SHOWN);
		return { queue, total, jobs: [...jobs] };
	}

	public async retry(queue: QueueName, jobId: string): Promise<void> {
		if ((await this.queues.retry(queue, jobId)) === "not-failed") {
			throw new OpsQueueJobNotFoundError(queue, jobId);
		}
	}

	public async discard(queue: QueueName, jobId: string): Promise<void> {
		if ((await this.queues.discard(queue, jobId)) === "not-failed") {
			throw new OpsQueueJobNotFoundError(queue, jobId);
		}
	}
}
