import { Logger } from "@nestjs/common";
import Redis from "ioredis";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AccessTokenStateService } from "../../auth/services/access-token-state.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { AuthorizationCacheService, type CachedAuthorization } from "./authorization-cache.service";
import {
	AUTHORIZATION_INVALIDATION_CHANNEL,
	AuthorizationInvalidationService,
	MAX_USER_IDS_PER_INVALIDATION_MESSAGE,
	type PolicyBundleCacheTarget,
} from "./authorization-invalidation.service";

/**
 * A real ioredis client that never connects (`lazyConnect`), with its network
 * calls stubbed: `publish` records, `subscribe` / `unsubscribe` track the
 * channel list, and incoming messages are simulated with `emit("message", …)`.
 */
class FakeRedis {
	public readonly client: Redis = new Redis({ lazyConnect: true });
	public readonly published: { readonly channel: string; readonly payload: string }[] = [];
	public readonly subscriptions: string[] = [];
	public failPublish = false;

	public constructor() {
		vi.spyOn(this.client, "connect").mockResolvedValue(undefined);
		vi.spyOn(this.client, "publish").mockImplementation((channel: string | Buffer, payload: string | Buffer | number) => {
			if (this.failPublish) {
				return Promise.reject(new Error("redis down"));
			}
			this.published.push({ channel: String(channel), payload: String(payload) });
			return Promise.resolve(1);
		});
		vi.spyOn(this.client, "subscribe").mockImplementation((channel: string | Buffer) => {
			this.subscriptions.push(String(channel));
			return Promise.resolve(1);
		});
		vi.spyOn(this.client, "unsubscribe").mockImplementation((channel: string | Buffer) => {
			this.subscriptions.splice(this.subscriptions.indexOf(String(channel)), 1);
			return Promise.resolve(0);
		});
	}

	public emit(channel: string, payload: string): void {
		this.client.emit("message", channel, payload);
	}
}

const MessageTypeSchema = z.object({ type: z.string() });

/** A policy-bundle cache that records what it was told to drop (`*` = everything). */
class RecordingBundleCache implements PolicyBundleCacheTarget {
	public readonly dropped: string[] = [];

	public invalidateOrganization(organizationId: string): void {
		this.dropped.push(organizationId);
	}

	public invalidateAll(): void {
		this.dropped.push("*");
	}
}

const REDIS_CONFIG = { REDIS_URL: "redis://cache:6379", AUTHORIZATION_CACHE_BACKEND: "redis", REDIS_NAMESPACE: "tenant-a" };
/** The channel instances in REDIS_CONFIG's namespace share. */
const CHANNEL = `tenant-a:${AUTHORIZATION_INVALIDATION_CHANNEL}`;

function cached(): CachedAuthorization {
	return { roles: ["Editor"], permissions: [{ action: "READ", resource: "USER" }], capabilities: [], cachedAt: 1 };
}

interface Instance {
	readonly service: AuthorizationInvalidationService;
	readonly cache: AuthorizationCacheService;
	readonly accessTokenState: AccessTokenStateService;
}

function instance(publisher: FakeRedis, subscriber: FakeRedis, env: Record<string, string> = REDIS_CONFIG): Instance {
	const config = createTestTypedConfig(env);
	const cache = new AuthorizationCacheService(config);
	const accessTokenState = new AccessTokenStateService(createTestPrisma(config), config);
	return { service: new AuthorizationInvalidationService(cache, accessTokenState, config, publisher.client, subscriber.client), cache, accessTokenState };
}

describe("AuthorizationInvalidationService", () => {
	let publisher: FakeRedis;
	let subscriber: FakeRedis;

	beforeEach(() => {
		publisher = new FakeRedis();
		subscriber = new FakeRedis();
	});

	it("applies locally and broadcasts user invalidations (incl. access-token state) to the other instances", async () => {
		const sender = instance(publisher, subscriber);
		const receiver = instance(publisher, subscriber);
		await receiver.service.onModuleInit();
		receiver.cache.set("user-1", cached());
		sender.cache.set("user-1", cached());
		const receiverTokenState = vi.spyOn(receiver.accessTokenState, "invalidate");

		await sender.service.invalidateUsers(["user-1", "user-1"], { accessTokenState: true, trigger: "password_reset" });
		const message = publisher.published.at(0);
		expect(message?.channel).toBe(CHANNEL);
		subscriber.emit(CHANNEL, message?.payload ?? "");

		expect(sender.cache.get("user-1")).toBeNull();
		expect(receiver.cache.get("user-1")).toBeNull();
		expect(receiverTokenState).toHaveBeenCalledWith("user-1");
		expect(subscriber.subscriptions).toEqual([CHANNEL]);
	});

	it("ignores invalidations from an API in another REDIS_NAMESPACE on the same Redis", async () => {
		const otherDeployment = instance(publisher, subscriber, { ...REDIS_CONFIG, REDIS_NAMESPACE: "tenant-b" });
		const receiver = instance(publisher, subscriber);
		await receiver.service.onModuleInit();
		receiver.cache.set("user-1", cached());

		await otherDeployment.service.invalidateUsers(["user-1"], { accessTokenState: true, trigger: "password_reset" });
		const message = publisher.published.at(0);
		expect(message?.channel).toBe(`tenant-b:${AUTHORIZATION_INVALIDATION_CHANNEL}`);
		subscriber.emit(message?.channel ?? "", message?.payload ?? "");

		expect(receiver.cache.get("user-1")).not.toBeNull();
	});

	it("skips its own messages and messages on other channels", async () => {
		const self = instance(publisher, subscriber);
		await self.service.onModuleInit();
		await self.service.invalidateUsers(["user-1"], { accessTokenState: true, trigger: "rbac_mutation" });
		self.cache.set("user-1", cached());

		subscriber.emit(CHANNEL, publisher.published.at(0)?.payload ?? "");
		subscriber.emit("other:channel", JSON.stringify({ type: "clear", origin: "someone-else" }));

		expect(self.cache.get("user-1")).not.toBeNull();
	});

	it("rejects malformed and non-JSON payloads without touching the cache", async () => {
		const receiver = instance(publisher, subscriber);
		await receiver.service.onModuleInit();
		receiver.cache.set("user-1", cached());

		subscriber.emit(CHANNEL, "{not json");
		subscriber.emit(CHANNEL, JSON.stringify({ type: "users", origin: "x", userIds: [] }));

		expect(receiver.cache.get("user-1")).not.toBeNull();
	});

	it("clears every instance on a catalog-wide change", async () => {
		const sender = instance(publisher, subscriber);
		const receiver = instance(publisher, subscriber);
		await receiver.service.onModuleInit();
		receiver.cache.set("user-9", cached());

		await sender.service.clearAll();
		subscriber.emit(CHANNEL, publisher.published.at(0)?.payload ?? "");

		expect(receiver.cache.size).toBe(0);
	});

	it("splits large invalidations into bounded messages", async () => {
		const sender = instance(publisher, subscriber);
		const userIds = Array.from({ length: MAX_USER_IDS_PER_INVALIDATION_MESSAGE + 1 }, (_value, index) => `user-${String(index)}`);

		await sender.service.invalidateUsers(userIds, { accessTokenState: false, trigger: "rbac_mutation" });

		expect(publisher.published).toHaveLength(2);
	});

	it("still invalidates locally when the publish fails after commit (other instances converge at TTL)", async () => {
		publisher.failPublish = true;
		const sender = instance(publisher, subscriber);
		sender.cache.set("user-1", cached());

		await expect(sender.service.invalidateUsers(["user-1"], { accessTokenState: true, trigger: "rbac_mutation" })).resolves.toBeUndefined();
		expect(sender.cache.get("user-1")).toBeNull();
	});

	it("stays local-only (no publish, no subscription) without the Redis authorization backend", async () => {
		const local = instance(publisher, subscriber, {});
		await local.service.onModuleInit();
		await local.service.invalidateUsers(["user-1"], { accessTokenState: true, trigger: "rbac_mutation" });

		expect(publisher.published).toEqual([]);
		expect(subscriber.subscriptions).toEqual([]);
	});

	it("drops registered policy-bundle caches locally and on every other instance after a policy publish", async () => {
		const sender = instance(publisher, subscriber);
		const receiver = instance(publisher, subscriber);
		await receiver.service.onModuleInit();
		const senderBundles = new RecordingBundleCache();
		const receiverBundles = new RecordingBundleCache();
		sender.service.registerPolicyBundleCache(senderBundles);
		receiver.service.registerPolicyBundleCache(receiverBundles);

		await sender.service.invalidatePolicyBundles({ kind: "organization", organizationId: "org-1" });
		await sender.service.invalidatePolicyBundles({ kind: "all" });
		for (const message of publisher.published) {
			subscriber.emit(CHANNEL, message.payload);
		}

		expect(senderBundles.dropped).toEqual(["org-1", "*"]);
		expect(receiverBundles.dropped).toEqual(["org-1", "*"]);
		// A policy publish leaves the per-user authorization cache alone.
		expect(publisher.published.map((message) => MessageTypeSchema.parse(JSON.parse(message.payload)).type)).toEqual(["policy_bundles", "policy_bundles"]);
	});

	it("rejects a policy-bundle message without an organization field", async () => {
		const receiver = instance(publisher, subscriber);
		await receiver.service.onModuleInit();
		const bundles = new RecordingBundleCache();
		receiver.service.registerPolicyBundleCache(bundles);

		subscriber.emit(CHANNEL, JSON.stringify({ type: "policy_bundles", origin: "other" }));

		expect(bundles.dropped).toEqual([]);
	});

	it("logs at debug which users, the trigger and the originating instance — locally and on the receiving instance", async () => {
		const debug = vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
		const sender = instance(publisher, subscriber);
		const receiver = instance(publisher, subscriber);
		await receiver.service.onModuleInit();

		await sender.service.invalidateUsers(["user-7"], { accessTokenState: true, trigger: "logout_all_devices" });
		const payload: string = publisher.published.at(0)?.payload ?? "";
		const origin: string = z.object({ origin: z.string() }).parse(JSON.parse(payload)).origin;
		subscriber.emit(CHANNEL, payload);

		const lines: string[] = debug.mock.calls.map((call) => String(call[0]));
		expect(lines).toEqual([
			`Invalidated authorization cache for 1 user(s) [user-7]: trigger=logout_all_devices, accessTokenState=true, origin=this instance ${origin}`,
			`Invalidated authorization cache for 1 user(s) [user-7]: trigger=logout_all_devices, accessTokenState=true, origin=remote instance ${origin}`,
		]);
		debug.mockRestore();
	});

	it("bounds the logged user-id list for bulk invalidations", async () => {
		const debug = vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
		const sender = instance(publisher, subscriber, {});
		const userIds = Array.from({ length: 12 }, (_value, index) => `u${String(index)}`);

		await sender.service.invalidateUsers(userIds, { accessTokenState: false, trigger: "rbac_mutation" });

		expect(String(debug.mock.calls.at(0)?.[0])).toContain("12 user(s) [u0, u1, u2, u3, u4, u5, u6, u7, u8, u9 (+2 more)]: trigger=rbac_mutation");
		debug.mockRestore();
	});

	it("rejects a user invalidation message without a trigger", async () => {
		const receiver = instance(publisher, subscriber);
		await receiver.service.onModuleInit();
		receiver.cache.set("user-1", cached());

		subscriber.emit(CHANNEL, JSON.stringify({ type: "users", origin: "other", userIds: ["user-1"], accessTokenState: true }));

		expect(receiver.cache.get("user-1")).not.toBeNull();
	});

	it("unsubscribes on shutdown without closing the shared clients", async () => {
		const self = instance(publisher, subscriber);
		await self.service.onModuleInit();

		await self.service.onModuleDestroy();

		expect(subscriber.subscriptions).toEqual([]);
	});
});
