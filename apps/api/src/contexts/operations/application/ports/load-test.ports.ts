// ============================================
// application/ports/load-test.ports.ts — handing a run to the load runner (ADR 068)
// ============================================

import type { LoadTestJob } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

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

/**
 * The Load Test tenant's reward picture: a READY reward image of that tenant, stored once and shown
 * by every provisioned reward (a published reward always shows at least one READY image).
 */
export interface LoadTestRewardImagePort {
	/** Its file id, stored on first use for `uploadedById`. Writes object storage: never call it inside a transaction. */
	ensure(actor: ActorContext, tenantId: string, uploadedById: string): Promise<string>;
}

export const LOAD_TEST_QUEUE = Symbol("LOAD_TEST_QUEUE");
export const LOAD_TEST_REWARD_IMAGE = Symbol("LOAD_TEST_REWARD_IMAGE");
export const LOAD_TEST_TRAFFIC = Symbol("LOAD_TEST_TRAFFIC");
export const LOAD_TEST_PASSWORDS = Symbol("LOAD_TEST_PASSWORDS");
