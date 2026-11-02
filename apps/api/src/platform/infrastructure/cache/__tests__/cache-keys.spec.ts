import { describe, expect, it } from "vitest";

import { PLATFORM_SCOPE, tenantScope, userScope } from "../../../application/ports/app-cache.port";
import { RedisNamespace } from "../../redis/redis-namespace";
import { cacheIndexKey, cacheInvalidationChannel, cacheLeaseKey, cacheTagKey, cacheValueKey, tenantTag } from "../cache-keys";

const NAMESPACE = new RedisNamespace("dev");
const CLEAR = { name: "tenancy.settings", version: 3, keyVersion: null };
const ENCRYPTED = { name: "identity.me", version: 1, keyVersion: 2 };

describe("cache keys", () => {
	it("carries the namespace, cache name, version and scope in every value key", () => {
		expect(cacheValueKey(NAMESPACE, CLEAR, tenantScope("t-1"), "settings")).toBe("dev:cache:tenancy.settings:v3:t:t-1:settings");
		expect(cacheValueKey(NAMESPACE, ENCRYPTED, userScope("u-1"), "me")).toBe("dev:cache:identity.me:v1:k2:u:u-1:me");
		expect(cacheValueKey(NAMESPACE, CLEAR, PLATFORM_SCOPE, "all")).toBe("dev:cache:tenancy.settings:v3:p:all");
	});

	it("never lets two tenants share a key", () => {
		expect(cacheValueKey(NAMESPACE, CLEAR, tenantScope("t-1"), "x")).not.toBe(cacheValueKey(NAMESPACE, CLEAR, tenantScope("t-2"), "x"));
	});

	it("keeps the index, tags and leases beside the values of one cache version", () => {
		expect(cacheIndexKey(NAMESPACE, CLEAR)).toBe("dev:cache:tenancy.settings:v3:#index");
		expect(cacheTagKey(NAMESPACE, CLEAR, tenantTag("t-1"))).toBe("dev:cache:tenancy.settings:v3:#tag:tenant:t-1");
		expect(cacheLeaseKey("dev:cache:x:v1:p:all")).toBe("dev:cache:x:v1:p:all:#lease");
		expect(cacheInvalidationChannel(NAMESPACE)).toBe("dev:cache:invalidate");
	});
});
