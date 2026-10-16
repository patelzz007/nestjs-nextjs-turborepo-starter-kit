import { describe, expect, it } from "vitest";

import { purgeInBatches, type BatchedPurgePolicy } from "./batched-purge";

const POLICY: BatchedPurgePolicy = { batchSize: 3, timeBudgetMs: 1_000 };
const START_MS = 1_790_812_800_000;

/** Manual clock: time only moves when a batch "takes" time. */
class ManualClock {
	public now: number = START_MS;

	public readonly read = (): number => this.now;
}

/** Deletes from a fixed backlog and records every batch size it was asked for. */
class FakeTable {
	public readonly requested: number[] = [];

	public constructor(
		private _remaining: number,
		private readonly _clock: ManualClock,
		private readonly _msPerBatch: number,
	) {}

	public readonly deleteBatch = async (batchSize: number): Promise<number> => {
		await Promise.resolve();
		this.requested.push(batchSize);
		this._clock.now += this._msPerBatch;
		const deleted: number = Math.min(batchSize, this._remaining);
		this._remaining -= deleted;
		return deleted;
	};

	public get left(): number {
		return this._remaining;
	}
}

describe("purgeInBatches", () => {
	it("deletes in bounded batches until a short batch shows the backlog is drained", async () => {
		const clock = new ManualClock();
		const table = new FakeTable(7, clock, 10);

		const result = await purgeInBatches(table.deleteBatch, POLICY, clock.read);

		expect(result).toEqual({ deleted: 7, batches: 3, durationMs: 30, stoppedBy: "drained" });
		expect(table.requested).toEqual([3, 3, 3]);
		expect(table.left).toBe(0);
	});

	it("runs exactly one (empty) batch when there is nothing to delete", async () => {
		const clock = new ManualClock();
		const table = new FakeTable(0, clock, 5);

		await expect(purgeInBatches(table.deleteBatch, POLICY, clock.read)).resolves.toEqual({ deleted: 0, batches: 1, durationMs: 5, stoppedBy: "drained" });
	});

	it("issues one extra probe batch when the backlog is an exact multiple of the batch size", async () => {
		const clock = new ManualClock();
		const table = new FakeTable(6, clock, 1);

		const result = await purgeInBatches(table.deleteBatch, POLICY, clock.read);

		expect(result).toMatchObject({ deleted: 6, batches: 3, stoppedBy: "drained" });
	});

	it("stops starting new batches once the time budget is spent and leaves the rest for the next run", async () => {
		const clock = new ManualClock();
		const table = new FakeTable(100, clock, 400);

		const result = await purgeInBatches(table.deleteBatch, POLICY, clock.read);

		// 400 ms per batch against a 1 000 ms budget: batches start at 0, 400 and 800 ms.
		expect(result).toEqual({ deleted: 9, batches: 3, durationMs: 1_200, stoppedBy: "time_budget" });
		expect(table.left).toBe(91);
	});

	it("always makes progress, even with a zero time budget", async () => {
		const clock = new ManualClock();
		const table = new FakeTable(100, clock, 1);

		const result = await purgeInBatches(table.deleteBatch, { batchSize: 3, timeBudgetMs: 0 }, clock.read);

		expect(result).toMatchObject({ deleted: 3, batches: 1, stoppedBy: "time_budget" });
	});

	it("propagates a failing batch so the scheduler retries the run", async () => {
		const clock = new ManualClock();
		const failing = async (): Promise<number> => {
			await Promise.resolve();
			throw new Error("connection lost");
		};

		await expect(purgeInBatches(failing, POLICY, clock.read)).rejects.toThrow("connection lost");
	});

	it("rejects a policy that could never delete anything or never stop", async () => {
		const clock = new ManualClock();
		const table = new FakeTable(1, clock, 1);

		await expect(purgeInBatches(table.deleteBatch, { batchSize: 0, timeBudgetMs: 1 }, clock.read)).rejects.toBeInstanceOf(RangeError);
		await expect(purgeInBatches(table.deleteBatch, { batchSize: 1.5, timeBudgetMs: 1 }, clock.read)).rejects.toBeInstanceOf(RangeError);
		await expect(purgeInBatches(table.deleteBatch, { batchSize: 1, timeBudgetMs: -1 }, clock.read)).rejects.toBeInstanceOf(RangeError);
		expect(table.requested).toEqual([]);
	});
});
