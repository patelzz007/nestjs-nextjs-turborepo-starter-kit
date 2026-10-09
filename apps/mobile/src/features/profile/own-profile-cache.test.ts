import { apiRouter, ApiError } from "@workspace/api-client";
import { epochMs, OwnProfileSchema, type Envelope, type OwnProfile } from "@workspace/shared";
import { QueryClient } from "@tanstack/react-query";

import { profileJson } from "../../../test/fixtures";
import { applyOwnProfileUpdated, applyOwnProfileUpdateFailed, isStaleProfileVersionError } from "./own-profile-cache";

function envelope(version: number): Envelope<OwnProfile> {
	return { success: true, data: OwnProfileSchema.parse(profileJson(version)), meta: { correlationId: "c", timestamp: epochMs(1_791_504_000_000) } };
}

describe("own profile cache", () => {
	it("stores the updated profile and refetches /auth/me", async () => {
		const queryClient = new QueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");

		await applyOwnProfileUpdated(queryClient, envelope(4));

		expect(queryClient.getQueryData(apiRouter.auth.profile.queryKey(undefined))).toEqual(envelope(4));
		expect(invalidate).toHaveBeenCalledWith({ queryKey: apiRouter.auth.me.scopeKey(undefined) });
	});

	it("reloads the profile after a stale-version refusal only", async () => {
		const queryClient = new QueryClient();
		const invalidate = jest.spyOn(queryClient, "invalidateQueries");
		const conflict = new ApiError({ message: "Changed", error: "CONFLICT", statusCode: 409 });

		expect(isStaleProfileVersionError(conflict)).toBe(true);
		await applyOwnProfileUpdateFailed(queryClient, conflict);
		await applyOwnProfileUpdateFailed(queryClient, new Error("network"));

		expect(invalidate).toHaveBeenCalledTimes(1);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: apiRouter.auth.profile.scopeKey(undefined) });
	});
});
