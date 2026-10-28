// ============================================
// application/ports/load-test.ports.ts — handing a run to the load runner (ADR 068)
// ============================================

import type { LoadTestJob } from "@workspace/shared";

export interface LoadTestQueuePort {
	/** Whether the runner's queue exists here (it needs Redis). */
	readonly available: boolean;
	enqueue(job: LoadTestJob): Promise<void>;
	/** Removes a run the runner has not picked up yet; `true` when it was still waiting. */
	removeWaiting(runId: string): Promise<boolean>;
}

/** One fresh password per run, and its hash for every load-test user. */
export interface LoadTestPasswordPort {
	issue(): Promise<{ readonly password: string; readonly hash: string }>;
}

/** A run's own rate-limit bucket: a random key the throttlers let through while it is live. */
export interface LoadTestTrafficPort {
	issue(key: string, ttlMs: number): Promise<void>;
}

export const LOAD_TEST_QUEUE = Symbol("LOAD_TEST_QUEUE");
export const LOAD_TEST_TRAFFIC = Symbol("LOAD_TEST_TRAFFIC");
export const LOAD_TEST_PASSWORDS = Symbol("LOAD_TEST_PASSWORDS");
