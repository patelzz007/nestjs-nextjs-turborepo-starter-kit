import { describe, expect, it } from "vitest";

import { RedisNamespace } from "./redis-namespace";

describe("RedisNamespace", () => {
	const namespace = new RedisNamespace("e2e:run-1");

	it("prefixes keys and channels with the namespace", () => {
		expect(namespace.key("auth:me:user-1")).toBe("e2e:run-1:auth:me:user-1");
		expect(namespace.channel("authz:invalidate")).toBe("e2e:run-1:authz:invalidate");
	});

	it("builds SCAN patterns confined to the namespace, escaping glob characters in the key prefix", () => {
		expect(namespace.scanPattern("auth:me:")).toBe("e2e:run-1:auth:me:*");
		expect(namespace.scanPattern("odd*[key]?")).toBe("e2e:run-1:odd\\*\\[key\\]\\?*");
	});

	it("gives two namespaces disjoint names for the same key and channel", () => {
		const other = new RedisNamespace("dev");
		expect(other.key("auth:me:user-1")).not.toBe(namespace.key("auth:me:user-1"));
		expect(other.channel("authz:invalidate")).not.toBe(namespace.channel("authz:invalidate"));
	});
});
