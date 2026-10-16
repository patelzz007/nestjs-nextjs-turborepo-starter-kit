import { QueryClient } from "@tanstack/react-query";
import { epochMs } from "@workspace/shared";
import { afterEach, describe, expect, it } from "vitest";

import { envelopeFixture, META_FIXTURE, sessionPermissionsFixture, userFixture } from "../../../test/auth-fixtures";
import { apiRouter } from "../../api/endpoints";
import { createAuthQueryCache } from "./auth-query-cache";

const ME_KEY = apiRouter.auth.me.queryKey(undefined);
const PERMISSIONS_KEY = apiRouter.auth.permissions.queryKey(undefined);
/** Some other feature's cached query — data of the session that must not outlive it. */
const OTHER_DATA_KEY = apiRouter.geo.stats.queryKey({});

let queryClient = new QueryClient();

function cachedProfile(): ReturnType<typeof apiRouter.auth.me.responseSchema.safeParse> {
	return apiRouter.auth.me.responseSchema.safeParse(queryClient.getQueryData(ME_KEY));
}

afterEach((): void => {
	queryClient.clear();
	queryClient = new QueryClient();
});

describe("createAuthQueryCache", () => {
	it("keys the session queries by their scope only — the keys api.auth.me/permissions.useQuery() read", () => {
		expect(ME_KEY).toEqual(["auth", "me"]);
		expect(PERMISSIONS_KEY).toEqual(["auth", "permissions"]);
	});

	it("seeds /auth/me with the server's own envelope under the key the me query reads", () => {
		const profile = envelopeFixture(userFixture({ fullName: "Ada Member" }));

		createAuthQueryCache(queryClient).seedProfile(profile);

		const cached = cachedProfile();
		expect(cached.success).toBe(true);
		expect(cached.data).toEqual(profile);
		expect(cached.data?.meta).toEqual(META_FIXTURE);
	});

	it("stamps the seeded /auth/me with the server's answer time, so staleness is measured from when the server answered", () => {
		const answeredAt = epochMs(1_786_428_123_000);
		const profile = envelopeFixture(userFixture(), { correlationId: "corr-me", timestamp: answeredAt });

		createAuthQueryCache(queryClient).seedProfile(profile);

		expect(queryClient.getQueryState(ME_KEY)?.dataUpdatedAt).toBe(answeredAt);
		expect(queryClient.getQueryState(ME_KEY)?.dataUpdatedAt).toBe(profile.meta.timestamp);
	});

	it("seeds /auth/permissions with the server's own envelope, stamped with its answer time", () => {
		const answeredAt = epochMs(1_786_428_456_000);
		const permissions = envelopeFixture(sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" }), {
			correlationId: "corr-permissions",
			timestamp: answeredAt,
		});

		createAuthQueryCache(queryClient).seedSessionPermissions(permissions);

		const cached = apiRouter.auth.permissions.responseSchema.safeParse(queryClient.getQueryData(PERMISSIONS_KEY));
		expect(cached.data).toEqual(permissions);
		expect(cached.data?.meta).toEqual({ correlationId: "corr-permissions", timestamp: answeredAt });
		expect(queryClient.getQueryState(PERMISSIONS_KEY)?.dataUpdatedAt).toBe(permissions.meta.timestamp);
	});

	it("reads whose profile is cached, and nobody's when nothing is", () => {
		const cache = createAuthQueryCache(queryClient);
		expect(cache.readProfileId()).toBeNull();

		cache.seedProfile(envelopeFixture(userFixture({ id: "member-x" })));

		expect(cache.readProfileId()).toBe("member-x");
	});

	it("drops only the cached permissions answer", () => {
		const cache = createAuthQueryCache(queryClient);
		cache.seedProfile(envelopeFixture(userFixture()));
		cache.seedSessionPermissions(envelopeFixture(sessionPermissionsFixture()));

		cache.dropSessionPermissions();

		expect(queryClient.getQueryData(PERMISSIONS_KEY)).toBeUndefined();
		expect(cachedProfile().success).toBe(true);
	});

	it("drops every query and mutation of the previous session", () => {
		const cache = createAuthQueryCache(queryClient);
		cache.seedProfile(envelopeFixture(userFixture()));
		queryClient.setQueryData(OTHER_DATA_KEY, { rows: 3 });

		cache.clear();

		expect(queryClient.getQueryCache().getAll()).toEqual([]);
		expect(queryClient.getMutationCache().getAll()).toEqual([]);
	});

	it("aborts an in-flight fetch when it clears", () => {
		const cache = createAuthQueryCache(queryClient);
		let aborted = false;
		void queryClient
			.query({
				queryKey: ["slow"],
				queryFn: ({ signal }): Promise<number> =>
					new Promise<number>((resolve): void => {
						signal.addEventListener("abort", (): void => {
							aborted = true;
							resolve(0);
						});
					}),
			})
			.catch((): void => undefined);

		cache.clear();

		expect(aborted).toBe(true);
	});
});
