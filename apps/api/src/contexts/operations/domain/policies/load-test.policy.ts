// ============================================
// domain/policies/load-test.policy.ts — the rules a load test runs under (ADR 068)
// ============================================
// Pure functions (no I/O): the caps a run must fit, when it aborts itself, and its verdict.

import {
	LOAD_TEST_ABORT_CPU_PERCENT,
	LOAD_TEST_ABORT_CPU_SECONDS,
	LOAD_TEST_ABORT_ERROR_PERCENT,
	LOAD_TEST_ABORT_ERROR_SECONDS,
	type LoadTestCaps,
	type LoadTestPoint,
	type StartLoadTestInput,
} from "@workspace/shared";

import { LoadTestOverCapError } from "../errors/operations.errors";

const SECONDS_PER_MINUTE = 60;
const HUNDRED = 100;

/** Refuses a run that asks for more than the caps in force; a soak run has its own, longer duration cap. */
export function assertWithinCaps(run: Pick<StartLoadTestInput, "virtualUsers" | "requestsPerSecond" | "durationSeconds" | "shape">, caps: LoadTestCaps): void {
	if (run.virtualUsers > caps.maxVirtualUsers) {
		throw new LoadTestOverCapError("Virtual users", run.virtualUsers, caps.maxVirtualUsers);
	}
	if (run.requestsPerSecond > caps.maxRequestsPerSecond) {
		throw new LoadTestOverCapError("Requests per second", run.requestsPerSecond, caps.maxRequestsPerSecond);
	}
	const maxSeconds: number = (run.shape === "SOAK" ? caps.maxSoakMinutes : caps.maxMinutes) * SECONDS_PER_MINUTE;
	if (run.durationSeconds > maxSeconds) {
		throw new LoadTestOverCapError("Duration (seconds)", run.durationSeconds, maxSeconds);
	}
}

/** The share of failed requests, in percent; 0 when there were none. */
export function errorPercent(requests: number, failures: number): number {
	return requests === 0 ? 0 : (failures / requests) * HUNDRED;
}

/**
 * Why the run must stop now, or `null`: errors above {@link LOAD_TEST_ABORT_ERROR_PERCENT}% in each of the
 * last {@link LOAD_TEST_ABORT_ERROR_SECONDS} seconds, or a server above {@link LOAD_TEST_ABORT_CPU_PERCENT}%
 * CPU for {@link LOAD_TEST_ABORT_CPU_SECONDS} seconds.
 */
export function autoAbortReason(points: readonly LoadTestPoint[], serverCpuOverSince: ReadonlyMap<string, number>, nowSecond: number): string | null {
	const recent: readonly LoadTestPoint[] = points.slice(-LOAD_TEST_ABORT_ERROR_SECONDS);
	if (recent.length === LOAD_TEST_ABORT_ERROR_SECONDS && recent.every((point) => errorPercent(point.requests, point.failures) > LOAD_TEST_ABORT_ERROR_PERCENT)) {
		return `Errors stayed above ${String(LOAD_TEST_ABORT_ERROR_PERCENT)}% for ${String(LOAD_TEST_ABORT_ERROR_SECONDS)} seconds`;
	}
	for (const [server, sinceSecond] of serverCpuOverSince) {
		if (nowSecond - sinceSecond >= LOAD_TEST_ABORT_CPU_SECONDS) {
			return `${server} stayed above ${String(LOAD_TEST_ABORT_CPU_PERCENT)}% CPU for ${String(LOAD_TEST_ABORT_CPU_SECONDS)} seconds`;
		}
	}
	return null;
}

/** A finished run passes when its p95 and its error share are within its thresholds. */
export function loadTestPassed(
	totals: { readonly requests: number; readonly failures: number; readonly p95Ms: number | null },
	thresholds: { readonly p95Ms: number; readonly errorPercent: number },
): boolean {
	return totals.requests > 0 && totals.p95Ms !== null && totals.p95Ms <= thresholds.p95Ms && errorPercent(totals.requests, totals.failures) <= thresholds.errorPercent;
}
