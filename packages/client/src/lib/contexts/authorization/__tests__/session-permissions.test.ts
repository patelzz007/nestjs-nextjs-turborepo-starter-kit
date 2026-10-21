import { PERMISSION, SessionPermissionsResponseSchema, type CapabilitySlug, type SessionPermissionsResponse } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { resolveSessionCapabilities, SESSION_PERMISSIONS_QUERY_OPTIONS, SESSION_PERMISSIONS_REFETCH_INTERVAL_MS } from "../session-permissions";

function permissions(capabilities: readonly CapabilitySlug[]): SessionPermissionsResponse {
	return SessionPermissionsResponseSchema.parse({
		roles: [],
		permissions: [],
		tokenVersion: 1,
		hasAdminAccess: false,
		capabilities: [...capabilities],
		isImpersonating: false,
		sessionScope: "full",
	});
}

describe("resolveSessionCapabilities", () => {
	it("returns an empty set when nothing is known (guest)", () => {
		expect(resolveSessionCapabilities(undefined, undefined)).toEqual([]);
	});

	it("uses the preloaded list before the first live answer", () => {
		expect(resolveSessionCapabilities(undefined, permissions([PERMISSION.REWARD.CREATE]))).toEqual([PERMISSION.REWARD.CREATE]);
	});

	it("prefers the live answer, even when it is empty", () => {
		expect(resolveSessionCapabilities(permissions([]), permissions([PERMISSION.REWARD.CREATE]))).toEqual([]);
	});
});

describe("SESSION_PERMISSIONS_QUERY_OPTIONS", () => {
	it("polls every minute, refreshes on focus and retries once", () => {
		expect(SESSION_PERMISSIONS_QUERY_OPTIONS).toEqual({ retry: 1, staleTime: 30_000, refetchOnWindowFocus: true, refetchInterval: SESSION_PERMISSIONS_REFETCH_INTERVAL_MS });
		expect(SESSION_PERMISSIONS_REFETCH_INTERVAL_MS).toBe(60_000);
	});
});
