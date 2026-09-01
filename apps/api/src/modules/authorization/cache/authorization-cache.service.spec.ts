import { describe, expect, it, vi, beforeEach } from "vitest";

import { AuthorizationCacheService, type CachedAuthorization } from "./authorization-cache.service";

describe("AuthorizationCacheService", () => {
	let service: AuthorizationCacheService;

	beforeEach(() => {
		service = new AuthorizationCacheService();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function makeAuth(overrides: Partial<CachedAuthorization> = {}): CachedAuthorization {
		return {
			roles: ["admin"],
			permissions: [{ action: "users.view", resource: "users" }],
			cachedAt: Date.now(),
			...overrides,
		};
	}

	describe("get / set", () => {
		it("returns null on cache miss", () => {
			expect(service.get("nonexistent")).toBeNull();
		});

		it("returns cached value after set", () => {
			const auth = makeAuth();
			service.set("user-1", auth);
			expect(service.get("user-1")).toEqual(auth);
		});

		it("respects custom TTL", () => {
			const auth = makeAuth();
			service.set("user-1", auth, 1000); // 1 second TTL
			vi.advanceTimersByTime(999);
			expect(service.get("user-1")).not.toBeNull();
			vi.advanceTimersByTime(2);
			expect(service.get("user-1")).toBeNull();
		});

		it("expires after default TTL (5 minutes)", () => {
			const auth = makeAuth();
			service.set("user-1", auth);
			vi.advanceTimersByTime(5 * 60 * 1000 - 1);
			expect(service.get("user-1")).not.toBeNull();
			vi.advanceTimersByTime(2);
			expect(service.get("user-1")).toBeNull();
		});
	});

	describe("invalidate", () => {
		it("removes a single user from cache", () => {
			service.set("user-1", makeAuth());
			service.set("user-2", makeAuth());
			service.invalidate("user-1");
			expect(service.get("user-1")).toBeNull();
			expect(service.get("user-2")).not.toBeNull();
		});
	});

	describe("invalidateUsers", () => {
		it("removes multiple users from cache", () => {
			service.set("user-1", makeAuth());
			service.set("user-2", makeAuth());
			service.set("user-3", makeAuth());
			service.invalidateUsers(["user-1", "user-3"]);
			expect(service.get("user-1")).toBeNull();
			expect(service.get("user-2")).not.toBeNull();
			expect(service.get("user-3")).toBeNull();
		});
	});

	describe("clear", () => {
		it("removes all entries", () => {
			service.set("user-1", makeAuth());
			service.set("user-2", makeAuth());
			service.clear();
			expect(service.size).toBe(0);
			expect(service.get("user-1")).toBeNull();
		});
	});

	describe("size", () => {
		it("tracks the number of entries", () => {
			expect(service.size).toBe(0);
			service.set("user-1", makeAuth());
			expect(service.size).toBe(1);
			service.set("user-2", makeAuth());
			expect(service.size).toBe(2);
			service.invalidate("user-1");
			expect(service.size).toBe(1);
		});
	});

	describe("role hierarchy", () => {
		it("returns null when hierarchy is not set", () => {
			expect(service.getHierarchy()).toBeNull();
		});

		it("stores and retrieves hierarchy", () => {
			const hierarchy = new Map([
				["admin", null],
				["manager", "admin"],
			]);
			service.setHierarchy(hierarchy);
			const cached = service.getHierarchy();
			expect(cached).not.toBeNull();
			expect(cached?.get("admin")).toBeNull();
			expect(cached?.get("manager")).toBe("admin");
		});

		it("invalidates hierarchy", () => {
			service.setHierarchy(new Map([["admin", null]]));
			service.invalidateHierarchy();
			expect(service.getHierarchy()).toBeNull();
		});
	});

	describe("getMemoryEstimate", () => {
		it("returns zero for empty cache", () => {
			const estimate = service.getMemoryEstimate();
			expect(estimate.entries).toBe(0);
			expect(estimate.estimatedBytes).toBe(0);
		});

		it("estimates memory for cached entries", () => {
			service.set("user-1", makeAuth());
			service.set("user-2", makeAuth());
			const estimate = service.getMemoryEstimate();
			expect(estimate.entries).toBe(2);
			expect(estimate.estimatedBytes).toBe(400); // 2 * 200
		});
	});
});
