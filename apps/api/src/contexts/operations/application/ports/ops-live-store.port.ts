// ============================================
// application/ports/ops-live-store.port.ts — the latest numbers, shared by every instance
// ============================================
// The live gauges read from here, not from the database: a server's latest sample, every
// instance's latest heartbeat, the latest dependency checks. Short-lived by design.

import type { OpsDependencyStatus, OpsInstanceLive, OpsServerLive } from "@workspace/shared";

export interface OpsLiveStore {
	putServerLive(serverId: string, live: OpsServerLive): Promise<void>;
	/** The latest samples of the given servers that have not expired. */
	serverLive(serverIds: readonly string[]): Promise<ReadonlyMap<string, OpsServerLive>>;
	putInstance(live: OpsInstanceLive): Promise<void>;
	/** An instance shut down cleanly: it leaves the list (a crashed one stays, and shows Down). */
	removeInstance(instanceId: string): Promise<void>;
	/** Every instance's latest heartbeat. */
	instances(): Promise<readonly OpsInstanceLive[]>;
	/** Forgets instances whose latest heartbeat is older than `before` (retired by a crash long ago). */
	pruneInstances(before: number): Promise<number>;
	putDependencies(statuses: readonly OpsDependencyStatus[]): Promise<void>;
	dependencies(): Promise<readonly OpsDependencyStatus[]>;
	/** Takes a short lock so only one instance runs the minute's collection (`true` when this one got it). */
	claimMinute(job: string, bucketStart: number): Promise<boolean>;
	/** Flags a load test to stop (the load runner polls it). */
	requestStop(key: string): Promise<void>;
	/** The full store key of a stop flag, as the load runner reads it. */
	stopFlagKey(key: string): string;
	/** Stores a one-time download ticket for `ttlMs`. */
	putTicket(ticket: string, value: string, ttlMs: number): Promise<void>;
	/** Reads and deletes a ticket (one use only); `null` when unknown, used or expired. */
	takeTicket(ticket: string): Promise<string | null>;
}

export const OPS_LIVE_STORE = Symbol("OPS_LIVE_STORE");
