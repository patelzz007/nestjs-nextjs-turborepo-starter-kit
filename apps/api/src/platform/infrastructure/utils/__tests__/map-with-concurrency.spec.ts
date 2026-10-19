import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "../map-with-concurrency";

/** A task whose completion the test controls, recording how many run at once. */
function tracker(): { readonly task: (item: number) => Promise<number>; readonly peak: () => number; readonly started: number[] } {
	let running = 0;
	let peak = 0;
	const started: number[] = [];
	const task = async (item: number): Promise<number> => {
		started.push(item);
		running += 1;
		peak = Math.max(peak, running);
		// Later items finish first, so the results must be re-ordered.
		await new Promise<void>((resolve) => setTimeout(resolve, 10 - item));
		running -= 1;
		return item * 10;
	};
	return { task, peak: () => peak, started };
}

describe("mapWithConcurrency", () => {
	it("returns the results in the items' order, never running more than the limit at once", async () => {
		const { task, peak } = tracker();

		await expect(mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, task)).resolves.toEqual([10, 20, 30, 40, 50, 60]);
		expect(peak()).toBe(2);
	});

	it("runs everything at once when the limit exceeds the items, and handles no items", async () => {
		const { task, peak } = tracker();

		await expect(mapWithConcurrency([1, 2, 3], 8, task)).resolves.toEqual([10, 20, 30]);
		expect(peak()).toBe(3);
		await expect(mapWithConcurrency([], 4, task)).resolves.toEqual([]);
	});

	it("passes each item's index", async () => {
		await expect(mapWithConcurrency(["a", "b"], 2, (item, index) => Promise.resolve(`${item}${String(index)}`))).resolves.toEqual(["a0", "b1"]);
	});

	it("stops starting work after a failure, lets running tasks finish, and rethrows the first failure unchanged", async () => {
		const failure = new Error("item 2 failed");
		const finished: number[] = [];
		const task = async (item: number): Promise<number> => {
			await new Promise<void>((resolve) => setTimeout(resolve, item === 1 ? 20 : 1));
			if (item === 2) {
				throw failure;
			}
			finished.push(item);
			return item;
		};

		await expect(mapWithConcurrency([1, 2, 3, 4, 5], 2, task)).rejects.toBe(failure);
		expect(finished).toContain(1);
		expect(finished).not.toContain(5);
	});

	it("refuses a limit that is not a positive whole number", async () => {
		await expect(mapWithConcurrency([1], 0, (item) => Promise.resolve(item))).rejects.toBeInstanceOf(RangeError);
		await expect(mapWithConcurrency([1], 1.5, (item) => Promise.resolve(item))).rejects.toBeInstanceOf(RangeError);
	});
});
