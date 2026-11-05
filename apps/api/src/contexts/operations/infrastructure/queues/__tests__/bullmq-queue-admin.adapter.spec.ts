import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { jobsInWindow, UnavailableQueueAdmin } from "../bullmq-queue-admin.adapter";

const MINUTE = 60_000;
const NOW = epochMs(Date.UTC(2026, 10, 3, 12, 30, 15));
const WINDOW = 60;

function metrics(prevTS: number, count: number, prevCount: number, data: readonly number[]): Parameters<typeof jobsInWindow>[0] {
	return { meta: { count, prevTS, prevCount }, data: [...data] };
}

describe("jobsInWindow (BullMQ's per-minute metrics over the last hour)", () => {
	it("counts the jobs since the last data point, which BullMQ hasn't written as a point yet", () => {
		expect(jobsInWindow(metrics(NOW - 5_000, 7, 4, []), NOW, WINDOW)).toBe(3);
	});

	it("adds the data points that fall inside the window, and none older", () => {
		// Last point written 2 minutes ago: points are the minutes 3, 4, … before now; 57 of them fit in the hour.
		const data = Array.from({ length: 70 }, () => 1);
		expect(jobsInWindow(metrics(NOW - 2 * MINUTE, 10, 10, data), NOW, WINDOW)).toBe(57);
	});

	it("counts nothing once the last activity is older than the window (stale points aren't recent)", () => {
		expect(jobsInWindow(metrics(NOW - 3 * 60 * MINUTE, 50, 20, [5, 5, 5]), NOW, WINDOW)).toBe(0);
	});

	it("counts the very first job, before BullMQ has a previous timestamp", () => {
		expect(jobsInWindow(metrics(0, 1, 0, []), NOW, WINDOW)).toBe(1);
	});
});

describe("UnavailableQueueAdmin (no Redis)", () => {
	it("has no queues and nothing to act on", async () => {
		const queues = new UnavailableQueueAdmin();
		expect(queues.available).toBe(false);
		await expect(queues.snapshots()).resolves.toStrictEqual([]);
		await expect(queues.failedJobs()).resolves.toStrictEqual({ total: 0, jobs: [] });
		await expect(queues.retry()).resolves.toBe("not-failed");
		await expect(queues.discard()).resolves.toBe("not-failed");
	});
});
