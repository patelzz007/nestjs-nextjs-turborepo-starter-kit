import { describe, expect, it } from "vitest";

import { SecurityKeyStore } from "./security-key-store";

describe("SecurityKeyStore", () => {
	it("tracks keys until expiry and sweeps stale entries", () => {
		const store = new SecurityKeyStore<string>({ maxKeys: 5 });
		expect(store.reserveKey("a", 100, 0)).toBe(true);
		expect(store.has("a", 50)).toBe(true);
		expect(store.has("a", 150)).toBe(false);
		expect(store.sweepExpired(150)).toBe(0);
	});

	it("rejects new keys at capacity without evicting active windows", () => {
		const store = new SecurityKeyStore<string>({ maxKeys: 1 });
		expect(store.reserveKey("attacker", 10_000, 0)).toBe(true);
		expect(store.reserveKey("victim", 10_000, 0)).toBe(false);
		expect(store.has("attacker", 0)).toBe(true);
	});

	it("allows refreshing an existing key even when at capacity", () => {
		const store = new SecurityKeyStore<string>({ maxKeys: 1 });
		expect(store.reserveKey("user", 100, 0)).toBe(true);
		expect(store.reserveKey("user", 200, 50)).toBe(true);
		expect(store.has("user", 150)).toBe(true);
	});
});
