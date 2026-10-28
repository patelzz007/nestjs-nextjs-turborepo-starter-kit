// ============================================
// infrastructure/live/redis-ops-live.store.ts — the live numbers in Redis (or in memory)
// ============================================
// Design patterns:
//   - ADAPTER: `RedisOpsLiveStore` implements the application's `OpsLiveStore` port on Redis;
//     `InMemoryOpsLiveStore` implements the same port for a deployment without Redis (one
//     instance only) and for tests (Liskov: either is usable wherever the port is).
//   - Every value is re-validated with zod on the way OUT: Redis is shared infrastructure, and
//     what comes back is never trusted to be what was written.

import {
	OPS_LIVE_SAMPLE_TTL_MS,
	OpsDependencyStatusSchema,
	OpsInstanceLiveSchema,
	OpsServerLiveSchema,
	type OpsDependencyStatus,
	type OpsInstanceLive,
	type OpsServerLive,
} from "@workspace/shared";
import type { Redis } from "ioredis";
import { z } from "zod";

import type { RedisNamespace } from "../../../../platform/infrastructure/redis/redis-namespace";
import type { OpsLiveStore } from "../../application/ports/ops-live-store.port";

/** Keys under the API's Redis namespace. */
const KEYS = {
	serverLive: (serverId: string): string => `ops:server-live:${serverId}`,
	instances: "ops:instances",
	dependencies: "ops:dependencies",
	minute: (job: string, bucketStart: number): string => `ops:minute:${job}:${String(bucketStart)}`,
	stop: (key: string): string => `ops:stop:${key}`,
	ticket: (ticket: string): string => `ops:ticket:${ticket}`,
};

/** How long the dependency list stays readable without a new check. */
const DEPENDENCIES_TTL_MS = 3 * 60_000;
/** How long a minute's collection lock is held (a little under the minute). */
const MINUTE_LOCK_MS = 55_000;
/** How long a stop flag lives (longer than any load test). */
const STOP_FLAG_TTL_MS = 13 * 60 * 60_000;

const DependencyListSchema = z.array(OpsDependencyStatusSchema);

/** Parses a stored JSON value; anything unreadable counts as absent (and is overwritten next time). */
function parseJson<Schema extends z.ZodType>(schema: Schema, raw: string | null | undefined): z.output<Schema> | null {
	if (raw === null || raw === undefined) {
		return null;
	}
	try {
		const parsed = schema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export class RedisOpsLiveStore implements OpsLiveStore {
	public constructor(
		private readonly redis: Pick<Redis, "set" | "mget" | "hset" | "hdel" | "hgetall" | "get" | "del" | "getdel">,
		private readonly namespace: RedisNamespace,
	) {}

	public async putServerLive(serverId: string, live: OpsServerLive): Promise<void> {
		await this.redis.set(this.namespace.key(KEYS.serverLive(serverId)), JSON.stringify(live), "PX", OPS_LIVE_SAMPLE_TTL_MS);
	}

	public async serverLive(serverIds: readonly string[]): Promise<ReadonlyMap<string, OpsServerLive>> {
		if (serverIds.length === 0) {
			return new Map();
		}
		const values: (string | null)[] = await this.redis.mget(...serverIds.map((id) => this.namespace.key(KEYS.serverLive(id))));
		return new Map(
			serverIds.flatMap((id, index): [string, OpsServerLive][] => {
				const live = parseJson(OpsServerLiveSchema, values.at(index));
				return live === null ? [] : [[id, live]];
			}),
		);
	}

	public async putInstance(live: OpsInstanceLive): Promise<void> {
		await this.redis.hset(this.namespace.key(KEYS.instances), live.instanceId, JSON.stringify(live));
	}

	public async removeInstance(instanceId: string): Promise<void> {
		await this.redis.hdel(this.namespace.key(KEYS.instances), instanceId);
	}

	public async instances(): Promise<readonly OpsInstanceLive[]> {
		const all: Record<string, string> = await this.redis.hgetall(this.namespace.key(KEYS.instances));
		return Object.values(all).flatMap((raw) => {
			const live = parseJson(OpsInstanceLiveSchema, raw);
			return live === null ? [] : [live];
		});
	}

	public async pruneInstances(before: number): Promise<number> {
		const all: Record<string, string> = await this.redis.hgetall(this.namespace.key(KEYS.instances));
		const stale: string[] = Object.entries(all).flatMap(([instanceId, raw]) => {
			const live = parseJson(OpsInstanceLiveSchema, raw);
			return live === null || live.sampledAt < before ? [instanceId] : [];
		});
		if (stale.length > 0) {
			await this.redis.hdel(this.namespace.key(KEYS.instances), ...stale);
		}
		return stale.length;
	}

	public async putDependencies(statuses: readonly OpsDependencyStatus[]): Promise<void> {
		await this.redis.set(this.namespace.key(KEYS.dependencies), JSON.stringify(statuses), "PX", DEPENDENCIES_TTL_MS);
	}

	public async dependencies(): Promise<readonly OpsDependencyStatus[]> {
		return parseJson(DependencyListSchema, await this.redis.get(this.namespace.key(KEYS.dependencies))) ?? [];
	}

	public async claimMinute(job: string, bucketStart: number): Promise<boolean> {
		return (await this.redis.set(this.namespace.key(KEYS.minute(job, bucketStart)), "1", "PX", MINUTE_LOCK_MS, "NX")) === "OK";
	}

	public async requestStop(key: string): Promise<void> {
		await this.redis.set(this.namespace.key(KEYS.stop(key)), "1", "PX", STOP_FLAG_TTL_MS);
	}

	public async putTicket(ticket: string, value: string, ttlMs: number): Promise<void> {
		await this.redis.set(this.namespace.key(KEYS.ticket(ticket)), value, "PX", ttlMs);
	}

	/** `GETDEL`: atomic, so two requests racing with one ticket cannot both use it. */
	public takeTicket(ticket: string): Promise<string | null> {
		return this.redis.getdel(this.namespace.key(KEYS.ticket(ticket)));
	}

	/** The Redis key the load runner polls for a stop request. */
	public stopFlagKey(key: string): string {
		return this.namespace.key(KEYS.stop(key));
	}
}

/** The same store in this process's memory: a single-instance deployment without Redis, and tests. */
export class InMemoryOpsLiveStore implements OpsLiveStore {
	private readonly servers = new Map<string, { readonly live: OpsServerLive; readonly expiresAt: number }>();
	private readonly instanceMap = new Map<string, OpsInstanceLive>();
	private dependencyList: readonly OpsDependencyStatus[] = [];
	private readonly claimed = new Set<string>();
	public readonly stopped = new Set<string>();

	public constructor(private readonly now: () => number = Date.now) {}

	public putServerLive(serverId: string, live: OpsServerLive): Promise<void> {
		this.servers.set(serverId, { live, expiresAt: this.now() + OPS_LIVE_SAMPLE_TTL_MS });
		return Promise.resolve();
	}

	public serverLive(serverIds: readonly string[]): Promise<ReadonlyMap<string, OpsServerLive>> {
		return Promise.resolve(
			new Map(
				serverIds.flatMap((id): [string, OpsServerLive][] => {
					const entry = this.servers.get(id);
					return entry === undefined || entry.expiresAt < this.now() ? [] : [[id, entry.live]];
				}),
			),
		);
	}

	public putInstance(live: OpsInstanceLive): Promise<void> {
		this.instanceMap.set(live.instanceId, live);
		return Promise.resolve();
	}

	public removeInstance(instanceId: string): Promise<void> {
		this.instanceMap.delete(instanceId);
		return Promise.resolve();
	}

	public instances(): Promise<readonly OpsInstanceLive[]> {
		return Promise.resolve([...this.instanceMap.values()]);
	}

	public pruneInstances(before: number): Promise<number> {
		const stale = [...this.instanceMap.values()].filter((live) => live.sampledAt < before);
		for (const live of stale) {
			this.instanceMap.delete(live.instanceId);
		}
		return Promise.resolve(stale.length);
	}

	public putDependencies(statuses: readonly OpsDependencyStatus[]): Promise<void> {
		this.dependencyList = statuses;
		return Promise.resolve();
	}

	public dependencies(): Promise<readonly OpsDependencyStatus[]> {
		return Promise.resolve(this.dependencyList);
	}

	public claimMinute(job: string, bucketStart: number): Promise<boolean> {
		const key = `${job}:${String(bucketStart)}`;
		if (this.claimed.has(key)) {
			return Promise.resolve(false);
		}
		this.claimed.add(key);
		return Promise.resolve(true);
	}

	public requestStop(key: string): Promise<void> {
		this.stopped.add(key);
		return Promise.resolve();
	}

	public stopFlagKey(key: string): string {
		return key;
	}

	private readonly tickets = new Map<string, { readonly value: string; readonly expiresAt: number }>();

	public putTicket(ticket: string, value: string, ttlMs: number): Promise<void> {
		this.tickets.set(ticket, { value, expiresAt: this.now() + ttlMs });
		return Promise.resolve();
	}

	public takeTicket(ticket: string): Promise<string | null> {
		const entry = this.tickets.get(ticket);
		this.tickets.delete(ticket);
		return Promise.resolve(entry === undefined || entry.expiresAt < this.now() ? null : entry.value);
	}
}
