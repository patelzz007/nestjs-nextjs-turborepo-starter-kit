import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { sessionPermissionsFixture, userFixture } from "../../../test/auth-fixtures";
import { apiRouter } from "../../api/endpoints";
import { createAuthQueryCache } from "./auth-query-cache";

const ME_KEY = apiRouter.auth.me.queryKey(undefined);
const PERMISSIONS_KEY = apiRouter.auth.permissions.queryKey(undefined);

let queryClient = new QueryClient();

function cachedProfile(): ReturnType<typeof apiRouter.auth.me.responseSchema.safeParse> {
	return apiRouter.auth.me.responseSchema.safeParse(queryClient.getQueryData(ME_KEY));
}

afterEach((): void => {
	queryClient.clear();
	queryClient = new QueryClient();
});

describe("createAuthQueryCache", () => {
	it("seeds /auth/me with a valid envelope under the key the me query reads", () => {
		const profile = userFixture({ fullName: "Ada Member" });

		createAuthQueryCache(queryClient).seedProfile(profile);

		const cached = cachedProfile();
		expect(cached.success).toBe(true);
		expect(cached.data?.data).toEqual(profile);
	});

	it("seeds /auth/permissions with a valid envelope", () => {
		const permissions = sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" });

		createAuthQueryCache(queryClient).seedSessionPermissions(permissions);

		const cached = apiRouter.auth.permissions.responseSchema.safeParse(queryClient.getQueryData(PERMISSIONS_KEY));
		expect(cached.data?.data).toEqual(permissions);
	});

	it("reads whose profile is cached, and nobody's when nothing is", () => {
		const cache = createAuthQueryCache(queryClient);
		expect(cache.readProfileId()).toBeNull();

		cache.seedProfile(userFixture({ id: "member-x" }));

		expect(cache.readProfileId()).toBe("member-x");
	});

	it("drops only the cached permissions answer", () => {
		const cache = createAuthQueryCache(queryClient);
		cache.seedProfile(userFixture());
		cache.seedSessionPermissions(sessionPermissionsFixture());

		cache.dropSessionPermissions();

		expect(queryClient.getQueryData(PERMISSIONS_KEY)).toBeUndefined();
		expect(cachedProfile().success).toBe(true);
	});

	it("marks the cached profile email-verified", () => {
		const cache = createAuthQueryCache(queryClient);
		cache.seedProfile(userFixture({ isEmailVerified: false }));

		cache.markEmailVerified();

		expect(cachedProfile().data?.data.isEmailVerified).toBe(true);
	});

	it("does not invent a profile when none is cached", () => {
		createAuthQueryCache(queryClient).markEmailVerified();

		expect(queryClient.getQueryData(ME_KEY)).toBeUndefined();
	});

	it("drops every query and mutation of the previous session", () => {
		const cache = createAuthQueryCache(queryClient);
		cache.seedProfile(userFixture());
		queryClient.setQueryData(["orders", "list"], { rows: 3 });

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
