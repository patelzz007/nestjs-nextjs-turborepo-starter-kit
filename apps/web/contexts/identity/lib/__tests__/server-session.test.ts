import type * as ServerApi from "@workspace/client/lib/api/server-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadWebServerSession } from "@/contexts/identity/lib/server-session";
import { failedQuery, httpFailure } from "@/test-support/server-query";
import { buildSessionPermissions, buildUserProfile, sessionPermissionsEnvelope, userProfileEnvelope } from "@/test-support/session";

const { meQuery, permissionsQuery, hasServerAccessSession } = vi.hoisted(() => ({
	meQuery: vi.fn(),
	permissionsQuery: vi.fn(),
	hasServerAccessSession: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@/lib/web-server-api", () => ({ createWebServerCaller: (): object => ({ auth: { me: { query: meQuery }, permissions: { query: permissionsQuery } } }) }));
vi.mock("@/contexts/identity/lib/server", () => ({ hasServerAccessSession }));
vi.mock("@workspace/client/lib/api/server-api", async (importOriginal) => {
	const { withTestFailureClassifier } = await import("@/test-support/server-query");
	return withTestFailureClassifier(await importOriginal<typeof ServerApi>());
});

const PROFILE = buildUserProfile({ isSuperAdmin: true });
const PERMISSIONS = buildSessionPermissions({ capabilities: ["rewards:claim"] });

beforeEach((): void => {
	hasServerAccessSession.mockResolvedValue(true);
	meQuery.mockResolvedValue(userProfileEnvelope(PROFILE));
	permissionsQuery.mockResolvedValue(sessionPermissionsEnvelope(PERMISSIONS));
	vi.spyOn(console, "error").mockImplementation((): void => {
		// unexpected failures are logged
	});
});

afterEach((): void => {
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("loadWebServerSession", () => {
	it("returns the API's profile and permissions envelopes (with the server's answer time) for the first paint", async () => {
		await expect(loadWebServerSession(true)).resolves.toEqual({
			profile: userProfileEnvelope(PROFILE),
			permissions: sessionPermissionsEnvelope(PERMISSIONS),
		});
	});

	it("does not call the API for a guest or a refresh-only session (the client resolves them)", async () => {
		await expect(loadWebServerSession(false)).resolves.toBeUndefined();
		hasServerAccessSession.mockResolvedValue(false);
		await expect(loadWebServerSession(true)).resolves.toBeUndefined();
		expect(meQuery).not.toHaveBeenCalled();
		expect(permissionsQuery).not.toHaveBeenCalled();
	});

	it("leaves a session the API rejects (401) to the client", async () => {
		meQuery.mockImplementation(() => failedQuery(httpFailure(401)));
		permissionsQuery.mockImplementation(() => failedQuery(httpFailure(401)));

		await expect(loadWebServerSession(true)).resolves.toBeUndefined();
	});

	it("rethrows an API outage instead of silently painting a page without its session", async () => {
		permissionsQuery.mockImplementation(() => failedQuery({ kind: "unreachable", cause: "ECONNREFUSED" }));

		await expect(loadWebServerSession(true)).rejects.toThrow("auth.permissions failed during server render: network (ECONNREFUSED)");
	});
});
