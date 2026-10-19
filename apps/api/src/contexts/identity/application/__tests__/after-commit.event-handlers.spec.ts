import { describe, expect, it } from "vitest";

import { UserAuthorizationChanged } from "../../../authorization/public-api";
import { DeviceSessionsRevoked, UserCredentialsChanged, UserProfileChanged } from "../../domain/events/identity.events";
import { InvalidateAccessTokenStateHandler } from "../event-handlers/after-commit/invalidate-access-token-state.event-handler";
import { InvalidateMeCacheOnAuthorizationChanged } from "../event-handlers/after-commit/invalidate-me-cache-on-authorization-changed.event-handler";
import { InvalidateMeCacheOnProfileChangedHandler } from "../event-handlers/after-commit/invalidate-me-cache-on-profile-changed.event-handler";
import type { AccessTokenInvalidationPort, AccessTokenInvalidationReason } from "../ports/access-token-invalidation.port";
import { InMemorySessionCache } from "./fakes/identity-sign-in.fakes";
import { NOW } from "./fakes/identity.fakes";

class RecordingInvalidation implements AccessTokenInvalidationPort {
	public readonly calls: { readonly userIds: readonly string[]; readonly reason: AccessTokenInvalidationReason }[] = [];

	public constructor(private readonly failure: Error | null = null) {}

	public invalidateUsers(userIds: readonly string[], reason: AccessTokenInvalidationReason): Promise<void> {
		if (this.failure !== null) {
			return Promise.reject(this.failure);
		}
		this.calls.push({ userIds, reason });
		return Promise.resolve();
	}
}

/** A cache whose every write fails (Redis down): the handlers must log, never throw after commit. */
class BrokenSessionCache extends InMemorySessionCache {
	public override invalidate(): Promise<void> {
		return Promise.reject(new Error("redis down"));
	}

	public override invalidateUsers(): Promise<void> {
		return Promise.reject(new Error("redis down"));
	}
}

describe("InvalidateAccessTokenStateHandler", () => {
	it("drops a changed user's token state everywhere and their cached profile", async () => {
		const invalidation = new RecordingInvalidation();
		const cache = new InMemorySessionCache();

		await new InvalidateAccessTokenStateHandler(invalidation, cache).handle(new UserCredentialsChanged("user-1", "password_changed", NOW));

		expect(invalidation.calls).toEqual([{ userIds: ["user-1"], reason: "password_changed" }]);
		expect(cache.invalidated).toEqual(["user-1"]);
	});

	it("drops the revoked sessions' token state without touching the profile cache", async () => {
		const invalidation = new RecordingInvalidation();
		const cache = new InMemorySessionCache();

		await new InvalidateAccessTokenStateHandler(invalidation, cache).handle(new DeviceSessionsRevoked(["user-1", "user-2"], "logout_all_devices", NOW));

		expect(invalidation.calls).toEqual([{ userIds: ["user-1", "user-2"], reason: "logout_all_devices" }]);
		expect(cache.invalidated).toEqual([]);
	});

	it("never throws after commit when the invalidation fails", async () => {
		await expect(
			new InvalidateAccessTokenStateHandler(new RecordingInvalidation(new Error("redis down")), new InMemorySessionCache()).handle(
				new UserCredentialsChanged("user-1", "password_changed", NOW),
			),
		).resolves.toBeUndefined();
	});
});

describe("/auth/me cache invalidation", () => {
	it("drops the cached profiles of users whose authorization or profile changed", async () => {
		const cache = new InMemorySessionCache();

		await new InvalidateMeCacheOnAuthorizationChanged(cache).handle(new UserAuthorizationChanged(NOW, ["user-1", "user-2"]));
		await new InvalidateMeCacheOnProfileChangedHandler(cache).handle(new UserProfileChanged("user-3", NOW));

		expect(cache.invalidated).toEqual(["user-1", "user-2", "user-3"]);
	});

	it("logs instead of throwing when the cache is unavailable", async () => {
		const cache = new BrokenSessionCache();

		await expect(new InvalidateMeCacheOnAuthorizationChanged(cache).handle(new UserAuthorizationChanged(NOW, ["user-1"]))).resolves.toBeUndefined();
		await expect(new InvalidateMeCacheOnProfileChangedHandler(cache).handle(new UserProfileChanged("user-1", NOW))).resolves.toBeUndefined();
	});
});
