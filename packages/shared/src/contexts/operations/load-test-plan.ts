// The load runner's plan (ADR 068), shared by the API (which validates a run), the load runner (which
// drives it) and the admin panel (which previews it): the read endpoints a single-endpoint test may
// call, and how each load shape changes the request rate over the run.

import { claimsRoutes, rewardNotificationsRoutes } from "../claims/routes";
import { authRoutes } from "../identity/routes";
import { legalRoutes, rewardsRoutes } from "../rewards/routes";
import type { LoadTestShape } from "./schemas/operations";

/**
 * The read (`GET`) endpoints a single-endpoint load test may call: a signed-in customer's own
 * screens, no path parameters. Writes happen only through scenarios.
 */
export const LOAD_TEST_READ_ENDPOINTS: readonly string[] = [rewardsRoutes.list, claimsRoutes.list, authRoutes.me, rewardNotificationsRoutes.list, legalRoutes.status];

/** One stage: reach `target` requests per second over `durationSeconds`. */
export interface LoadTestStage {
	readonly durationSeconds: number;
	readonly target: number;
}

const RAMP_SHARE = 0.2;
const SPIKE_BASELINE_SHARE = 0.2;
const SPIKE_SHARE = 0.1;

/** Splits `total` seconds into whole seconds by `shares` (the last absorbs rounding), at least 1 s each. */
function split(total: number, shares: readonly number[]): number[] {
	const seconds: number[] = shares.map((share) => Math.max(1, Math.floor(total * share)));
	const used: number = seconds.slice(0, -1).reduce((sum, value) => sum + value, 0);
	return [...seconds.slice(0, -1), Math.max(1, total - used)];
}

/**
 * The stages of a run (k6 `ramping-arrival-rate`):
 * - CONSTANT, SOAK: the full rate from the first second to the last;
 * - RAMP: up to the full rate over the first 20 %, hold, down over the last 20 %;
 * - SPIKE: a 20 % baseline, a jump to the full rate for the middle 10 %, back to the baseline.
 */
export function loadTestStages(shape: LoadTestShape, requestsPerSecond: number, durationSeconds: number): LoadTestStage[] {
	switch (shape) {
		case "CONSTANT":
		case "SOAK":
			return [
				{ durationSeconds: 1, target: requestsPerSecond },
				{ durationSeconds: Math.max(1, durationSeconds - 1), target: requestsPerSecond },
			];
		case "RAMP": {
			const [up = 1, hold = 1, down = 1] = split(durationSeconds, [RAMP_SHARE, 1 - 2 * RAMP_SHARE, RAMP_SHARE]);
			return [
				{ durationSeconds: up, target: requestsPerSecond },
				{ durationSeconds: hold, target: requestsPerSecond },
				{ durationSeconds: down, target: 0 },
			];
		}
		case "SPIKE": {
			const baseline: number = Math.max(1, Math.round(requestsPerSecond * SPIKE_BASELINE_SHARE));
			const calm: number = (1 - SPIKE_SHARE) / 2;
			const [before = 1, spike = 1, after = 1] = split(durationSeconds, [calm, SPIKE_SHARE, calm]);
			return [
				{ durationSeconds: before, target: baseline },
				{ durationSeconds: 1, target: requestsPerSecond },
				{ durationSeconds: Math.max(1, spike - 1), target: requestsPerSecond },
				{ durationSeconds: 1, target: baseline },
				{ durationSeconds: Math.max(1, after - 1), target: baseline },
			];
		}
	}
}
