import { Logger } from "@nestjs/common";
import { SessionPermissionsResponseSchema, UserResponseSchema, type SessionPermissionsResponse, type UserResponse } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { InMemoryCacheStore } from "../../../../../../test/support/in-memory-cache-store";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { GcmCacheCipher } from "../../../../../platform/infrastructure/cache/cache-cipher";
import { CacheInvalidationBus } from "../../../../../platform/infrastructure/cache/cache-invalidation-bus";
import { TieredAppCache } from "../../../../../platform/infrastructure/cache/tiered-app-cache";
import { RedisNamespace } from "../../../../../platform/infrastructure/redis/redis-namespace";
import { AppCacheUserSessionCache } from "../app-cache-user-session-cache";

const CACHE_KEYS = { 1: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=" };
const CREATED_AT = 1_790_000_000_000;
const ME: UserResponse = UserResponseSchema.parse({
	id: "user-1",
	email: "jane@example.com",
	fullName: "Jane Tan",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	twoFactorEnabled: false,
	hasAdminAccess: false,
	tokenVersion: 0,
	roles: [],
	createdAt: CREATED_AT,
	updatedAt: CREATED_AT,
	isDeleted: false,
	deletedAt: null,
});
const PERMISSIONS: SessionPermissionsResponse = SessionPermissionsResponseSchema.parse({
	roles: [],
	permissions: [],
	tokenVersion: 0,
	hasAdminAccess: false,
	capabilities: [],
	sessionScope: "full",
});

/** One API instance's session cache on the shared store. */
function instance(store: InMemoryCacheStore): AppCacheUserSessionCache {
	const cache = new TieredAppCache({ namespace: new RedisNamespace("test"), client: store.client(), cipher: new GcmCacheCipher(CACHE_KEYS), logger: new Logger("AppCache") });
	const bus = new CacheInvalidationBus(createTestTypedConfig(), null);
	cache.listen(bus);
	store.subscribe((_channel: string, payload: string): void => {
		bus.deliver(payload);
	});
	return new AppCacheUserSessionCache(createTestTypedConfig(), cache);
}

describe("AppCacheUserSessionCache", () => {
	it("shares /auth/me between instances, encrypted inside Redis", async () => {
		const store = new InMemoryCacheStore(Date.now);
		await instance(store).setMe("user-1", ME);

		expect(await instance(store).getMe("user-1")).toEqual(ME);
		expect([...store.values.values()].some((stored): boolean => stored.payload.includes("jane@example.com"))).toBe(false);
	});

	it("drops both payloads on every instance when the user's session data changes", async () => {
		const store = new InMemoryCacheStore(Date.now);
		const first = instance(store);
		const second = instance(store);
		await first.setMe("user-1", ME);
		await first.setPermissions("user-1", PERMISSIONS);

		await second.invalidateUsers(["user-1", "user-1"]);

		expect(await first.getMe("user-1")).toBeNull();
		expect(await first.getPermissions("user-1")).toBeNull();
		expect(store.values.size).toBe(0);
	});
});
