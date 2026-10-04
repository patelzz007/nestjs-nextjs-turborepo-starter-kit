/**
 * Readiness polling behind `wait-for-http.mjs`: wait until every URL answers
 * with a 2xx/3xx status, or fail with the last observed state of each URL once
 * the deadline passes. Used by CI and `pnpm ci:local` instead of fixed sleeps.
 * The clock, sleep and fetch are injected so the logic is unit-tested.
 */

/** Pause between polls of a URL that is not ready yet. */
export const DEFAULT_POLL_INTERVAL_MS = 1_000;
/** Per-request timeout, so a hung server cannot stall the loop past the deadline. */
export const REQUEST_TIMEOUT_MS = 5_000;

const FIRST_READY_STATUS = 200;
const FIRST_NOT_READY_STATUS = 400;

/** A 2xx or 3xx answer means the server is up (a page may redirect to its login). */
export function isReadyStatus(status) {
	return status >= FIRST_READY_STATUS && status < FIRST_NOT_READY_STATUS;
}

/**
 * @param {{
 *   urls: readonly string[],
 *   timeoutMs: number,
 *   pollIntervalMs?: number,
 *   fetchStatus: (url: string) => Promise<number>,
 *   now: () => number,
 *   sleep: (ms: number) => Promise<void>,
 * }} options
 * @returns {Promise<{ ready: true } | { ready: false, pending: { url: string, lastState: string }[] }>}
 */
export async function waitForHttp({ urls, timeoutMs, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, fetchStatus, now, sleep }) {
	const deadline = now() + timeoutMs;
	const lastState = new Map(urls.map((url) => [url, "not polled"]));
	const pending = new Set(urls);

	for (;;) {
		for (const url of [...pending]) {
			try {
				const status = await fetchStatus(url);
				lastState.set(url, `HTTP ${String(status)}`);
				if (isReadyStatus(status)) {
					pending.delete(url);
				}
			} catch (error) {
				lastState.set(url, error instanceof Error ? error.message : String(error));
			}
		}
		if (pending.size === 0) {
			return { ready: true };
		}
		if (now() >= deadline) {
			return { ready: false, pending: [...pending].map((url) => ({ url, lastState: lastState.get(url) ?? "unknown" })) };
		}
		await sleep(pollIntervalMs);
	}
}
