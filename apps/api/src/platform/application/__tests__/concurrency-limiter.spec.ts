import { describe, expect, it } from "vitest";

import { ConcurrencyLimiter } from "../concurrency-limiter";

/** A task the test finishes by hand. */
function deferred(): { readonly promise: Promise<void>; readonly finish: () => void; readonly fail: (error: Error) => void } {
	let finish: () => void = (): void => undefined;
	let fail: (error: Error) => void = (): void => undefined;
	const promise = new Promise<void>((resolve, reject): void => {
		finish = resolve;
		fail = reject;
	});
	return { promise, finish, fail };
}

async function settle(): Promise<void> {
	for (let turn = 0; turn < 5; turn += 1) {
		await Promise.resolve();
	}
}

describe("ConcurrencyLimiter", () => {
	it("runs at most `limit` tasks at once and queues the rest in order", async () => {
		const limiter = new ConcurrencyLimiter(2);
		const [first, second, third, fourth] = [deferred(), deferred(), deferred(), deferred()];
		const tasks = [first, second, third, fourth];
		const started: number[] = [];
		const runs = tasks.map((task, index) =>
			limiter.run(async (): Promise<number> => {
				started.push(index);
				await task.promise;
				return index;
			}),
		);
		await settle();
		expect(started).toEqual([0, 1]);
		expect(limiter.running).toBe(2);
		expect(limiter.queued).toBe(2);

		second.finish();
		await settle();
		expect(started).toEqual([0, 1, 2]);

		first.finish();
		third.finish();
		fourth.finish();
		expect(await Promise.all(runs)).toEqual([0, 1, 2, 3]);
		expect(limiter.running).toBe(0);
		expect(limiter.queued).toBe(0);
	});

	it("frees the slot when a task fails, and passes the failure to its caller", async () => {
		const limiter = new ConcurrencyLimiter(1);
		const failing = deferred();
		const failed = limiter.run(() => failing.promise);
		const next = limiter.run(() => Promise.resolve("ran"));

		failing.fail(new Error("boom"));

		await expect(failed).rejects.toThrow("boom");
		expect(await next).toBe("ran");
		expect(limiter.running).toBe(0);
	});

	it("refuses a limit that is not a whole number of at least 1", () => {
		expect(() => new ConcurrencyLimiter(0)).toThrow(RangeError);
		expect(() => new ConcurrencyLimiter(1.5)).toThrow(RangeError);
	});
});
