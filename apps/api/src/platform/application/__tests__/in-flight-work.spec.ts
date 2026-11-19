import { describe, expect, it } from "vitest";

import { InFlightWork } from "../in-flight-work";

/** A run the test finishes by hand. */
function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void; readonly reject: (error: Error) => void } {
	let resolve: (value: T) => void = (): void => undefined;
	let reject: (error: Error) => void = (): void => undefined;
	const promise = new Promise<T>((onResolve, onReject): void => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, resolve, reject };
}

describe("InFlightWork", () => {
	it("hands the caller the run's own result and forgets the run once it settled", async () => {
		const work = new InFlightWork();
		const run = deferred<string>();

		const result = work.track(() => run.promise);
		expect(work.size).toBe(1);
		run.resolve("done");

		await expect(result).resolves.toBe("done");
		await work.settled();
		expect(work.size).toBe(0);
	});

	it("hands the caller the run's own error, and settled() still resolves", async () => {
		const work = new InFlightWork();
		const run = deferred<string>();

		const result = work.track(() => run.promise);
		run.reject(new Error("sweep failed"));

		await expect(result).rejects.toThrow("sweep failed");
		await expect(work.settled()).resolves.toBeUndefined();
		expect(work.size).toBe(0);
	});

	it("settles only after every run, including one started while it was waiting", async () => {
		const work = new InFlightWork();
		const first = deferred<string>();
		const second = deferred<string>();
		const finished: string[] = [];
		void work.track(async () => {
			finished.push(await first.promise);
		});

		const waiting = work.settled().then((): void => {
			finished.push("settled");
		});
		void work.track(async () => {
			finished.push(await second.promise);
		});
		first.resolve("first");
		await Promise.resolve();
		second.resolve("second");
		await waiting;

		expect(finished).toStrictEqual(["first", "second", "settled"]);
	});

	it("settles at once when nothing is running", async () => {
		await expect(new InFlightWork().settled()).resolves.toBeUndefined();
	});
});
