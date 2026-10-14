import { CaughtValueSchema } from "@workspace/shared";

import { normalizeCaughtError } from "./caught-error";

/**
 * Maps `items` through `task` with at most `limit` tasks running at once, and
 * returns the results in the items' order. Every started task is awaited: on
 * failure, no new task starts, the running ones finish, and the first failure
 * (in item order) is rethrown — never a rejection with work still running.
 *
 * For CPU- or I/O-heavy batches (image rendering, uploads) where running all
 * at once oversubscribes the machine and one at a time leaves it idle.
 */
export async function mapWithConcurrency<TItem, TResult>(items: readonly TItem[], limit: number, task: (item: TItem, index: number) => Promise<TResult>): Promise<TResult[]> {
	if (!Number.isInteger(limit) || limit < 1) {
		throw new RangeError(`mapWithConcurrency needs a positive whole limit, got ${String(limit)}`);
	}
	const results = new Map<number, TResult>();
	const failures = new Map<number, Error>();
	const queue = [...items.entries()];

	const worker = async (): Promise<void> => {
		for (let entry = queue.shift(); entry !== undefined && failures.size === 0; entry = queue.shift()) {
			const [index, item] = entry;
			await task(item, index)
				.then((result) => {
					results.set(index, result);
				})
				.catch((error: unknown) => {
					const caught = CaughtValueSchema.safeParse(error);
					failures.set(index, caught.success ? normalizeCaughtError(caught.data) : new Error(`Task ${String(index)} failed with a value that is not an error`));
				});
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

	const [firstFailure] = [...failures.entries()].sort(([left], [right]) => left - right);
	if (firstFailure !== undefined) {
		const [, error] = firstFailure;
		throw error;
	}
	return [...results.entries()].sort(([left], [right]) => left - right).map(([, result]) => result);
}
