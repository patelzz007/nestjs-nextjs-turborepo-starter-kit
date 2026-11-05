import { epochMs, type EpochMs, type QueueName } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { OpsQueueJobNotFoundError } from "../../domain/errors/operations.errors";
import type { FailedJobAction, FailedJobSummary, QueueAdminPort, QueueSnapshot } from "../ports/queue-admin.port";
import { failureRatePercent, OperationsQueuesService } from "../services/operations-queues.service";

const NOW = epochMs(Date.UTC(2026, 10, 3, 12, 0));
const SNAPSHOT: QueueSnapshot = { name: "email.send", waiting: 3, active: 1, delayed: 0, failed: 2, paused: false, completedInWindow: 18, failedInWindow: 2 };
const FAILED: FailedJobSummary = { id: "j-1", name: "send", failedReason: "SMTP refused", attemptsMade: 3, maxAttempts: 3, createdAt: NOW, failedAt: NOW };

class RecordingQueues implements QueueAdminPort {
	public readonly available = true;
	public readonly windows: [number, EpochMs][] = [];
	public readonly acted: string[] = [];

	public constructor(private readonly outcome: FailedJobAction) {}

	public snapshots(windowMinutes: number, now: EpochMs): Promise<readonly QueueSnapshot[]> {
		this.windows.push([windowMinutes, now]);
		return Promise.resolve([SNAPSHOT]);
	}

	public failedJobs(): Promise<{ readonly total: number; readonly jobs: readonly FailedJobSummary[] }> {
		return Promise.resolve({ total: 9, jobs: [FAILED] });
	}

	public retry(queue: QueueName, jobId: string): Promise<FailedJobAction> {
		this.acted.push(`retry ${queue} ${jobId}`);
		return Promise.resolve(this.outcome);
	}

	public discard(queue: QueueName, jobId: string): Promise<FailedJobAction> {
		this.acted.push(`discard ${queue} ${jobId}`);
		return Promise.resolve(this.outcome);
	}
}

const clock = { now: (): EpochMs => NOW };

describe("failureRatePercent", () => {
	it("is failed ÷ finished to one decimal, and null when nothing finished", () => {
		expect(failureRatePercent(18, 2)).toBe(10);
		expect(failureRatePercent(2, 1)).toBe(33.3);
		expect(failureRatePercent(0, 0)).toBeNull();
		expect(failureRatePercent(0, 4)).toBe(100);
	});
});

describe("OperationsQueuesService", () => {
	it("reads every queue over the last hour and states each failure rate", async () => {
		const queues = new RecordingQueues("done");
		await expect(new OperationsQueuesService(queues, clock).list()).resolves.toStrictEqual({
			available: true,
			metricsWindowMinutes: 60,
			queues: [{ name: "email.send", waiting: 3, active: 1, delayed: 0, failed: 2, paused: false, completedLastHour: 18, failedLastHour: 2, failureRatePercent: 10 }],
		});
		expect(queues.windows).toStrictEqual([[60, NOW]]);
	});

	it("lists a queue's failed jobs with how many it holds", async () => {
		await expect(new OperationsQueuesService(new RecordingQueues("done"), clock).failedJobs("email.send")).resolves.toStrictEqual({
			queue: "email.send",
			total: 9,
			jobs: [FAILED],
		});
	});

	it("retries and discards a failed job, and answers not found for one that isn't failed", async () => {
		const done = new RecordingQueues("done");
		const service = new OperationsQueuesService(done, clock);
		await service.retry("email.send", "j-1");
		await service.discard("email.send", "j-2");
		expect(done.acted).toStrictEqual(["retry email.send j-1", "discard email.send j-2"]);

		const gone = new OperationsQueuesService(new RecordingQueues("not-failed"), clock);
		await expect(gone.retry("email.send", "j-3")).rejects.toBeInstanceOf(OpsQueueJobNotFoundError);
		await expect(gone.discard("email.send", "j-3")).rejects.toBeInstanceOf(OpsQueueJobNotFoundError);
	});
});
