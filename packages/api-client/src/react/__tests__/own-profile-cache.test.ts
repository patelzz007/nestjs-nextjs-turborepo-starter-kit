import { QueryClient } from "@tanstack/react-query";
import { ApiErrorCodes, epochMs, OwnProfileSchema, type Envelope, type OwnProfile } from "@workspace/shared";
import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "../../errors";
import { apiRouter } from "../../router";
import { applyOwnProfileUpdated, applyOwnProfileUpdateFailed, isStaleProfileVersionError } from "../own-profile-cache";

const ANSWERED_AT = epochMs(1_788_253_260_000);
const clients: QueryClient[] = [];

function queryClient(): QueryClient {
	const client = new QueryClient();
	clients.push(client);
	return client;
}

afterEach(() => {
	for (const client of clients.splice(0)) {
		client.clear();
	}
});

describe("own profile cache", () => {
	it("tells a stale-version refusal (409 CONFLICT) from any other failure", () => {
		expect(isStaleProfileVersionError(new ApiError({ message: "changed", statusCode: 409, error: ApiErrorCodes.CONFLICT }))).toBe(true);
		expect(isStaleProfileVersionError(new ApiError({ message: "nope", statusCode: 400 }))).toBe(false);
		expect(isStaleProfileVersionError(new Error("offline"))).toBe(false);
	});

	it("leaves the cache alone after any other failure", async () => {
		const client = queryClient();
		client.setQueryData(apiRouter.auth.profile.queryKey(undefined), "cached");

		await applyOwnProfileUpdateFailed(client, new Error("offline"));

		expect(client.getQueryState(apiRouter.auth.profile.queryKey(undefined))?.isInvalidated).toBe(false);
	});

	it("invalidates the profile after a stale-version refusal", async () => {
		const client = queryClient();
		client.setQueryData(apiRouter.auth.profile.queryKey(undefined), "cached");

		await applyOwnProfileUpdateFailed(client, new ApiError({ message: "changed", statusCode: 409, error: ApiErrorCodes.CONFLICT }));

		expect(client.getQueryState(apiRouter.auth.profile.queryKey(undefined))?.isInvalidated).toBe(true);
	});

	it("stores the saved profile at the answer's time", async () => {
		const client = queryClient();
		const profile: OwnProfile = OwnProfileSchema.parse({
			id: "6f1c3b8e-6a64-4b4e-9b7a-2f1f0a6f8d21",
			email: "member@example.com",
			fullName: "Alex Morgan",
			avatar: null,
			version: 4,
			createdAt: 0,
			updatedAt: 0,
		});
		const envelope: Envelope<OwnProfile> = { success: true, data: profile, meta: { correlationId: "test", timestamp: ANSWERED_AT } };

		await applyOwnProfileUpdated(client, envelope);

		expect(client.getQueryData(apiRouter.auth.profile.queryKey(undefined))).toBe(envelope);
		expect(client.getQueryState(apiRouter.auth.profile.queryKey(undefined))?.dataUpdatedAt).toBe(ANSWERED_AT);
	});
});
