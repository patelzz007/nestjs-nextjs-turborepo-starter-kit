import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { InMemoryCacheStore } from "../../../../../e2e/support/in-memory-cache-store";
import { createTestTypedConfig } from "../../../../../e2e/support/test-api-env";
import { defineCache, PLATFORM_SCOPE, tenantScope, userScope, type CacheDefinition, type CacheTier } from "../../../application/ports/app-cache.port";
import { RedisNamespace } from "../../redis/redis-namespace";
import { GcmCacheCipher } from "../cache-cipher";
import { CacheInvalidationBus } from "../cache-invalidation-bus";
import { cacheIndexKey, cacheLeaseKey, cacheValueKey } from "../cache-keys";
import { CACHE_CIRCUIT_FAILURE_THRESHOLD, CACHE_CIRCUIT_OPEN_MS, TieredAppCache } from "../tiered-app-cache";

const TTL_MS = 1_000;
const STALE_MS = 500;
const MAX_ENTRIES = 100;
const NAMESPACE = new RedisNamespace("test");
const KEYS_V1 = { 1: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=" };
const KEYS_V2 = { ...KEYS_V1, 2: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=" };

const SettingsSchema = z.object({ tenantId: z.string(), currency: z.string() });
type Settings = z.output<typeof SettingsSchema>;

/** A clock the test moves by hand. */
class ManualClock {
	public nowMs = 1_000_000;

	public readonly now = (): number => this.nowMs;

	public advance(milliseconds: number): void {
		this.nowMs += milliseconds;
	}
}

let cacheCounter = 0;

function settingsCache(
	tier: CacheTier,
	overrides: { readonly containsPersonalData?: boolean; readonly sharedMaxKeys?: number; readonly leaseMs?: number } = {},
): CacheDefinition<Settings, "tenant"> {
	cacheCounter += 1;
	return defineCache({
		name: `test.settings-${String(cacheCounter)}`,
		version: 1,
		schema: SettingsSchema,
		scope: "tenant",
		tier,
		ttlMs: TTL_MS,
		staleMs: STALE_MS,
		containsPersonalData: overrides.containsPersonalData ?? false,
		localMaxEntries: MAX_ENTRIES,
		sharedMaxKeys: overrides.sharedMaxKeys ?? MAX_ENTRIES,
		...(overrides.leaseMs === undefined ? {} : { leaseMs: overrides.leaseMs }),
		tags: (value: Settings): readonly string[] => [`currency:${value.currency}`],
	});
}

function silentLogger(): Logger {
	const logger = new Logger("test");
	vi.spyOn(logger, "warn").mockImplementation((): void => undefined);
	return logger;
}

interface Instance {
	readonly cache: TieredAppCache;
	readonly logger: Logger;
}

/** One API instance on the shared store, hearing the others' invalidations. */
function instance(store: InMemoryCacheStore | null, clock: ManualClock, keys: Readonly<Record<number, string>> | null = null): Instance {
	const logger = silentLogger();
	const cache = new TieredAppCache({
		namespace: NAMESPACE,
		client: store === null ? null : store.client(),
		cipher: keys === null ? null : new GcmCacheCipher(keys),
		logger,
		now: clock.now,
		// Advances the test clock, and yields a macrotask so another "instance" can act meanwhile.
		sleep: async (milliseconds: number): Promise<void> => {
			clock.advance(milliseconds);
			await new Promise<void>((resolve): void => {
				setImmediate(resolve);
			});
		},
	});
	// The real bus, fed by the shared store as `REDIS_SUBSCRIBER` would feed it.
	const bus = new CacheInvalidationBus(createTestTypedConfig(), null);
	cache.listen(bus);
	store?.subscribe((_channel: string, payload: string): void => {
		bus.deliver(payload);
	});
	return { cache, logger };
}

function loader(value: Settings): { readonly load: () => Promise<Settings>; readonly calls: () => number } {
	let calls = 0;
	return {
		load: async (): Promise<Settings> => {
			calls += 1;
			return Promise.resolve(value);
		},
		calls: (): number => calls,
	};
}

const ACME: Settings = { tenantId: "tenant-acme", currency: "MYR" };

describe("TieredAppCache — local tier", () => {
	it("loads once, then answers from memory until the value goes stale", async () => {
		const clock = new ManualClock();
		const { cache } = instance(null, clock);
		const definition = settingsCache("local");
		const source = loader(ACME);

		expect(await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load)).toEqual(ACME);
		expect(await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load)).toEqual(ACME);
		expect(source.calls()).toBe(1);
		expect(definition.counters).toMatchObject({ hits: 1, misses: 1, loads: 1 });
	});

	it("serves a stale value at once while one refresh runs, and loads again once past stale", async () => {
		const clock = new ManualClock();
		const { cache } = instance(null, clock);
		const definition = settingsCache("local");
		const source = loader(ACME);
		await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load);

		clock.advance(TTL_MS);
		expect(await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load)).toEqual(ACME);
		expect(definition.counters.staleServed).toBe(1);
		await vi.waitFor((): void => {
			expect(source.calls()).toBe(2);
			expect(definition.inFlight.size).toBe(0);
		});

		clock.advance(TTL_MS + STALE_MS);
		await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load);
		expect(source.calls()).toBe(3);
	});

	it("shares one load between concurrent misses (single flight)", async () => {
		const { cache } = instance(null, new ManualClock());
		const definition = settingsCache("local");
		const source = loader(ACME);

		await Promise.all([1, 2, 3].map(async (): Promise<Settings> => cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load)));
		expect(source.calls()).toBe(1);
	});

	it("serves the stale value when the loader fails, and throws when there is none", async () => {
		const clock = new ManualClock();
		const { cache } = instance(null, clock);
		const definition = settingsCache("local");
		await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", loader(ACME).load);
		const failing = async (): Promise<Settings> => Promise.reject(new Error("database down"));

		clock.advance(TTL_MS);
		expect(await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", failing)).toEqual(ACME);
		await expect(cache.getOrLoad(definition, tenantScope("tenant-other"), "settings", failing)).rejects.toThrow("database down");
		await vi.waitFor((): void => {
			expect(definition.counters.loadFailures).toBe(2);
		});
	});

	it("keeps tenants apart: one tenant's key never answers another", async () => {
		const { cache } = instance(null, new ManualClock());
		const definition = settingsCache("local");
		await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", loader(ACME).load);
		const other: Settings = { tenantId: "tenant-beta", currency: "SGD" };

		expect(await cache.getOrLoad(definition, tenantScope("tenant-beta"), "settings", loader(other).load)).toEqual(other);
	});

	it("does not keep a value whose load began before an invalidation", async () => {
		const { cache } = instance(null, new ManualClock());
		const definition = settingsCache("local");
		let release: (value: Settings) => void = (): void => undefined;
		let started = false;
		const rowRead = new Promise<Settings>((resolve): void => {
			release = resolve;
		});
		const slow = async (): Promise<Settings> => {
			started = true;
			return rowRead;
		};

		const pending = cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", slow);
		// The load has begun (it read the old row) when the change commits and invalidates.
		await vi.waitFor((): void => {
			expect(started).toBe(true);
		});
		await cache.invalidate(definition, tenantScope("tenant-acme"), "settings");
		release(ACME);
		expect(await pending).toEqual(ACME);
		expect(await cache.peek(definition, tenantScope("tenant-acme"), "settings")).toBeNull();
	});

	it("refuses two different caches declared with one name", () => {
		const { cache } = instance(null, new ManualClock());
		const first = settingsCache("local");
		const twin = defineCache({
			name: first.name,
			version: 1,
			schema: SettingsSchema,
			scope: "platform",
			tier: "local",
			ttlMs: TTL_MS,
			staleMs: 0,
			containsPersonalData: false,
			localMaxEntries: 1,
			sharedMaxKeys: 1,
		});
		cache.register(first);
		expect(() => {
			cache.register(twin);
		}).toThrow(`Two caches are declared with the name "${first.name}"`);
	});
});

describe("TieredAppCache — shared and two-tier across instances", () => {
	it("lets a second instance answer from Redis without loading", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = settingsCache("two-tier");
		const first = instance(store, clock);
		const second = instance(store, clock);
		const source = loader(ACME);

		await first.cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load);
		expect(await second.cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load)).toEqual(ACME);
		expect(source.calls()).toBe(1);
	});

	it("drops a value from Redis and from every instance's memory on invalidate", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = settingsCache("two-tier");
		const first = instance(store, clock);
		const second = instance(store, clock);
		await first.cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", loader(ACME).load);
		await second.cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", loader(ACME).load);

		await first.cache.invalidate(definition, tenantScope("tenant-acme"), "settings");

		expect(store.values.size).toBe(0);
		expect(await second.cache.peek(definition, tenantScope("tenant-acme"), "settings")).toBeNull();
	});

	it("drops every value filed under a tag, and a whole tenant across caches", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = settingsCache("two-tier");
		const { cache } = instance(store, clock);
		await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", loader(ACME).load);
		await cache.getOrLoad(definition, tenantScope("tenant-beta"), "settings", loader({ tenantId: "tenant-beta", currency: "MYR" }).load);
		await cache.getOrLoad(definition, tenantScope("tenant-gamma"), "settings", loader({ tenantId: "tenant-gamma", currency: "SGD" }).load);

		await cache.invalidateTag(definition, "currency:MYR");
		expect(await cache.peek(definition, tenantScope("tenant-acme"), "settings")).toBeNull();
		expect(await cache.peek(definition, tenantScope("tenant-beta"), "settings")).toBeNull();
		expect(await cache.peek(definition, tenantScope("tenant-gamma"), "settings")).not.toBeNull();

		await cache.flushTenant("tenant-gamma");
		expect(await cache.peek(definition, tenantScope("tenant-gamma"), "settings")).toBeNull();
	});

	it("flushes one cache everywhere by name", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = settingsCache("two-tier");
		const first = instance(store, clock);
		const second = instance(store, clock);
		second.cache.register(definition);
		await first.cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", loader(ACME).load);

		await second.cache.flushNamespace(definition.name);
		expect(store.values.size).toBe(0);
		expect(definition.localSize()).toBe(0);
		await expect(second.cache.flushNamespace("test.unknown")).rejects.toThrow('No cache is declared with the name "test.unknown"');
	});

	it("stores within the key budget and counts a refused write", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = settingsCache("shared", { sharedMaxKeys: 1 });
		const { cache } = instance(store, clock);

		await cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", loader(ACME).load);
		await cache.getOrLoad(definition, tenantScope("tenant-beta"), "settings", loader({ tenantId: "tenant-beta", currency: "SGD" }).load);
		expect(store.values.size).toBe(1);
		expect(definition.counters.refusedWrites).toBe(1);
		expect((await cache.stats()).find((stats): boolean => stats.name === definition.name)).toMatchObject({ sharedKeys: 1, sharedMaxKeys: 1 });
	});

	it("treats a stored value that fails its schema as a miss", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = settingsCache("shared");
		const first = instance(store, clock);
		await first.cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", loader(ACME).load);
		for (const [key, stored] of store.values) {
			store.values.set(key, { ...stored, payload: stored.payload.replace('"MYR"', "42") });
		}
		const source = loader(ACME);

		expect(await instance(store, clock).cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load)).toEqual(ACME);
		expect(source.calls()).toBe(1);
	});

	it("waits for the lease holder's value instead of loading a second time", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = settingsCache("shared", { leaseMs: TTL_MS });
		const parts = { name: definition.name, version: definition.version, keyVersion: null };
		const valueKey = cacheValueKey(NAMESPACE, parts, tenantScope("tenant-acme"), "settings");
		// Another instance holds the lease and stores its value while this one waits.
		const other = store.client();
		await other.takeLease(cacheLeaseKey(valueKey), TTL_MS);
		const lifetimeMs = TTL_MS + STALE_MS;
		await other.write(
			valueKey,
			cacheIndexKey(NAMESPACE, parts),
			[],
			JSON.stringify({ value: ACME, storedAt: clock.nowMs, freshUntil: clock.nowMs, staleUntil: clock.nowMs }),
			lifetimeMs,
			MAX_ENTRIES,
		);
		const waiter = instance(store, clock);
		const source = loader({ tenantId: "tenant-acme", currency: "LOADED" });
		// What the waiter first reads is already past its freshness; the holder's fresh value lands next.
		const fresh = JSON.stringify({ value: ACME, storedAt: clock.nowMs, freshUntil: clock.nowMs + lifetimeMs, staleUntil: clock.nowMs + lifetimeMs });
		store.values.delete(valueKey);
		setImmediate((): void => {
			void other.write(valueKey, cacheIndexKey(NAMESPACE, parts), [], fresh, lifetimeMs, MAX_ENTRIES);
		});

		expect(await waiter.cache.getOrLoad(definition, tenantScope("tenant-acme"), "settings", source.load)).toEqual(ACME);
		expect(source.calls()).toBe(0);
	});
});

describe("TieredAppCache — personal data", () => {
	const PersonSchema = z.object({ email: z.string() });

	function personCache(): CacheDefinition<z.output<typeof PersonSchema>, "user"> {
		cacheCounter += 1;
		return defineCache({
			name: `test.person-${String(cacheCounter)}`,
			version: 1,
			schema: PersonSchema,
			scope: "user",
			tier: "shared",
			ttlMs: TTL_MS,
			staleMs: 0,
			containsPersonalData: true,
			localMaxEntries: MAX_ENTRIES,
			sharedMaxKeys: MAX_ENTRIES,
		});
	}

	it("stores personal data encrypted in Redis and reads it back on another instance", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = personCache();
		await instance(store, clock, KEYS_V1).cache.getOrLoad(definition, userScope("user-1"), "me", async () => Promise.resolve({ email: "jane@example.com" }));

		const [stored] = [...store.values.values()];
		expect(stored?.payload).not.toContain("jane@example.com");
		expect(await instance(store, clock, KEYS_V1).cache.getOrLoad(definition, userScope("user-1"), "me", async () => Promise.resolve({ email: "loaded@example.com" }))).toEqual(
			{
				email: "jane@example.com",
			},
		);
	});

	it("puts the key version in the key, so a rotation turns old entries into misses", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = personCache();
		await instance(store, clock, KEYS_V1).cache.getOrLoad(definition, userScope("user-1"), "me", async () => Promise.resolve({ email: "old@example.com" }));

		const rotated = await instance(store, clock, KEYS_V2).cache.getOrLoad(definition, userScope("user-1"), "me", async () => Promise.resolve({ email: "new@example.com" }));
		expect(rotated).toEqual({ email: "new@example.com" });
		expect([...store.values.keys()].some((key: string): boolean => key.includes(":k2:"))).toBe(true);
	});

	it("never writes personal data to Redis without a key ring", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = personCache();
		await instance(store, clock, null).cache.getOrLoad(definition, userScope("user-1"), "me", async () => Promise.resolve({ email: "jane@example.com" }));

		expect(store.values.size).toBe(0);
	});
});

describe("TieredAppCache — Redis failures", () => {
	it("opens the circuit after repeated failures, answers from the loader, and closes it again", async () => {
		const clock = new ManualClock();
		const store = new InMemoryCacheStore(clock.now);
		const definition = settingsCache("shared");
		const { cache } = instance(store, clock);
		store.failing = true;
		const source = loader(ACME);

		for (let attempt = 0; attempt < CACHE_CIRCUIT_FAILURE_THRESHOLD; attempt += 1) {
			expect(await cache.getOrLoad(definition, PLATFORM_SCOPE_FOR_TENANT, `k${String(attempt)}`, source.load)).toEqual(ACME);
		}
		expect(cache.isCircuitOpen()).toBe(true);
		const callsWhileOpen = store.calls;
		await cache.getOrLoad(definition, PLATFORM_SCOPE_FOR_TENANT, "open", source.load);
		expect(store.calls).toBe(callsWhileOpen);

		store.failing = false;
		clock.advance(CACHE_CIRCUIT_OPEN_MS);
		expect(cache.isCircuitOpen()).toBe(false);
		expect(await cache.memory()).toMatchObject({ policy: "noeviction" });
	});
});

/** A tenant scope for the failure tests (any tenant: the cache is tenant-scoped). */
const PLATFORM_SCOPE_FOR_TENANT = tenantScope("tenant-acme");

describe("cache scopes", () => {
	it("offers one platform scope", () => {
		expect(PLATFORM_SCOPE).toEqual({ scope: "platform" });
	});
});

describe("CacheInvalidationBus", () => {
	it("ignores a message that is not a cache invalidation", () => {
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
		const bus = new CacheInvalidationBus(createTestTypedConfig(), null);
		const handler = vi.fn();
		bus.onMessage(handler);

		bus.deliver("not json");
		bus.deliver(JSON.stringify({ name: "x" }));
		expect(handler).not.toHaveBeenCalled();
		bus.deliver(JSON.stringify({ origin: "other", name: "x", all: true }));
		expect(handler).toHaveBeenCalledWith({ origin: "other", name: "x", all: true });
		warn.mockRestore();
	});
});
