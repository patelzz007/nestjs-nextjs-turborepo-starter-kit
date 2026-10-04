import { QueryClient } from "@tanstack/react-query";
import { epochMs, type OwnProfile } from "@workspace/shared";
import { afterEach, describe, expect, it } from "vitest";

import { envelopeFixture, userFixture } from "../../../test/auth-fixtures";
import { ApiError } from "../../api/api-request";
import { apiRouter } from "../../api/endpoints";
import { applyOwnProfileUpdated, applyOwnProfileUpdateFailed, isStaleProfileVersionError } from "./own-profile-cache";

const PROFILE_KEY = apiRouter.auth.profile.queryKey(undefined);
const ME_KEY = apiRouter.auth.me.queryKey(undefined);
const ANSWERED_AT = epochMs(1_788_253_260_000);

function profileFixture(overrides: Partial<OwnProfile> = {}): OwnProfile {
	return {
		id: "4f0b7c62-3f7a-4c0e-9d8e-2f6a1b3c5d7e",
		email: "user@example.com",
		fullName: "Regular User",
		avatar: null,
		version: 1,
		createdAt: epochMs(1_788_000_000_000),
		updatedAt: epochMs(1_788_253_200_000),
		...overrides,
	};
}

let queryClient = new QueryClient();

afterEach((): void => {
	queryClient.clear();
	queryClient = new QueryClient();
});

describe("isStaleProfileVersionError", () => {
	it("recognises the API's 409 CONFLICT", () => {
		expect(isStaleProfileVersionError(new ApiError({ message: "changed", error: "CONFLICT", statusCode: 409 }))).toBe(true);
	});

	it("does not treat other failures as a stale version", () => {
		expect(isStaleProfileVersionError(new ApiError({ message: "no", error: "PROFILE_UPDATE_DURING_IMPERSONATION", statusCode: 403 }))).toBe(false);
		expect(isStaleProfileVersionError(new Error("network"))).toBe(false);
	});
});

describe("applyOwnProfileUpdated", () => {
	it("caches the returned profile and marks /auth/me stale (it carries the name)", async () => {
		queryClient.setQueryData(ME_KEY, envelopeFixture(userFixture()));
		const updated = envelopeFixture(profileFixture({ fullName: "Jane Doe", version: 2 }), { correlationId: "corr-patch", timestamp: ANSWERED_AT });

		await applyOwnProfileUpdated(queryClient, updated);

		expect(apiRouter.auth.profile.responseSchema.parse(queryClient.getQueryData(PROFILE_KEY))).toEqual(updated);
		expect(queryClient.getQueryState(PROFILE_KEY)?.dataUpdatedAt).toBe(ANSWERED_AT);
		expect(queryClient.getQueryState(ME_KEY)?.isInvalidated).toBe(true);
	});
});

describe("applyOwnProfileUpdateFailed", () => {
	it("reloads the profile after a stale-version refusal", async () => {
		queryClient.setQueryData(PROFILE_KEY, envelopeFixture(profileFixture()));

		await applyOwnProfileUpdateFailed(queryClient, new ApiError({ message: "changed", error: "CONFLICT", statusCode: 409 }));

		expect(queryClient.getQueryState(PROFILE_KEY)?.isInvalidated).toBe(true);
	});

	it("leaves the cache alone for any other failure", async () => {
		queryClient.setQueryData(PROFILE_KEY, envelopeFixture(profileFixture()));

		await applyOwnProfileUpdateFailed(queryClient, new ApiError({ message: "invalid", error: "VALIDATION_ERROR", statusCode: 400 }));

		expect(queryClient.getQueryState(PROFILE_KEY)?.isInvalidated).toBe(false);
	});
});
