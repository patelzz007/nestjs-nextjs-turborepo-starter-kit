import { describe, expect, it } from "vitest";

import { e2eRedisNamespaceFor, purgeBullMqPrefix, resolveE2eBullMqPrefix, type PurgeableRedis } from "./e2e-bullmq-prefix";

/**
 * In-memory SCAN/DEL over a key set, two keys per page so pagination is
 * exercised. Like Redis, the cursor walks a stable keyspace snapshot, so
 * deleting between pages never skips keys.
 */
function fakeRedis(keys: string[]): { readonly redis: PurgeableRedis; readonly remaining: () => string[] } {
	const store = new Set(keys);
	const keyspace: readonly string[] = [...keys].sort();
	const redis: PurgeableRedis = {
		scan: async (cursor: string, _match: "MATCH", pattern: string): Promise<[string, string[]]> => {
			const prefix = pattern.slice(0, -1);
			const matching = keyspace.filter((key) => key.startsWith(prefix));
			const start = Number(cursor);
			const page = matching.slice(start, start + 2);
			const next = start + 2 >= matching.length ? "0" : String(start + 2);
			return Promise.resolve([next, page]);
		},
		del: async (...doomed: string[]): Promise<number> => {
			doomed.forEach((key) => store.delete(key));
			return Promise.resolve(doomed.length);
		},
	};
	return { redis, remaining: () => [...store].sort() };
}

describe("resolveE2eBullMqPrefix", () => {
	it("gives every run its own e2e:<uuid> prefix, never the shared default", () => {
		const first = resolveE2eBullMqPrefix(undefined);
		const second = resolveE2eBullMqPrefix(undefined);

		expect(first).toMatch(/^e2e:[0-9a-f-]{36}$/);
		expect(first).not.toBe(second);
	});

	it("honours a runner-chosen prefix inside the e2e / ci-local namespaces only", () => {
		expect(resolveE2eBullMqPrefix("ci-local:1791005000000")).toBe("ci-local:1791005000000");
		expect(() => resolveE2eBullMqPrefix("bull")).toThrow(/must start with/);
		expect(() => resolveE2eBullMqPrefix("e2e: spaces")).toThrow();
	});
});

describe("e2eRedisNamespaceFor", () => {
	it("gives the run its own REDIS_NAMESPACE next to (never inside) its BullMQ keyspace", () => {
		expect(e2eRedisNamespaceFor("e2e:0b1c")).toBe("e2e:0b1c-kv");
		expect(e2eRedisNamespaceFor("ci-local:1791005000000")).toBe("ci-local:1791005000000-kv");
		expect(() => e2eRedisNamespaceFor("bull")).toThrow(/must start with/);
	});

	it("is purged by the same per-run purge without touching the dev API's namespace", async () => {
		const { redis, remaining } = fakeRedis(["e2e:a-kv:auth:me:u1", "e2e:a-kv:throttle:x", "dev:auth:me:u1"]);

		await expect(purgeBullMqPrefix(redis, e2eRedisNamespaceFor("e2e:a"))).resolves.toBe(2);
		expect(remaining()).toEqual(["dev:auth:me:u1"]);
	});
});

describe("purgeBullMqPrefix", () => {
	it("deletes every key of the run, across SCAN pages, and nothing else", async () => {
		const { redis, remaining } = fakeRedis(["e2e:a:email.send:1", "e2e:a:email.send:2", "e2e:a:outbox.publish:meta", "e2e:ab:x", "bull:email.send:1"]);

		await expect(purgeBullMqPrefix(redis, "e2e:a")).resolves.toBe(3);
		expect(remaining()).toEqual(["bull:email.send:1", "e2e:ab:x"]);
	});
});
