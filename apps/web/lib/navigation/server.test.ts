import type * as ServerApi from "@workspace/client/lib/api/server-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadWebInitialSessionPermissions } from "@/lib/navigation/server";
import { failedQuery, httpFailure } from "@/test-support/server-query";
import { buildSessionPermissions, sessionPermissionsEnvelope } from "@/test-support/session";

const { permissionsQuery, hasServerAccessSession } = vi.hoisted(() => ({
	permissionsQuery: vi.fn(),
	hasServerAccessSession: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@/lib/web-server-api", () => ({ createWebServerCaller: (): object => ({ auth: { permissions: { query: permissionsQuery } } }) }));
vi.mock("@/lib/auth/server", () => ({ hasServerAccessSession }));
vi.mock("@workspace/client/lib/api/server-api", async (importOriginal) => {
	const { withTestFailureClassifier } = await import("@/test-support/server-query");
	return withTestFailureClassifier(await importOriginal<typeof ServerApi>());
});

const PERMISSIONS = buildSessionPermissions({ capabilities: ["rewards:claim"] });

beforeEach((): void => {
	hasServerAccessSession.mockResolvedValue(true);
	vi.spyOn(console, "error").mockImplementation((): void => {
		// unexpected failures are logged
	});
});

afterEach((): void => {
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("loadWebInitialSessionPermissions", () => {
	it("returns the session's permissions envelope (with the server's answer time) for first paint", async () => {
		permissionsQuery.mockResolvedValue(sessionPermissionsEnvelope(PERMISSIONS));

		await expect(loadWebInitialSessionPermissions(true)).resolves.toEqual(sessionPermissionsEnvelope(PERMISSIONS));
	});

	it("does not call the API for a guest or a refresh-only session (the client resolves them)", async () => {
		await expect(loadWebInitialSessionPermissions(false)).resolves.toBeUndefined();
		hasServerAccessSession.mockResolvedValue(false);
		await expect(loadWebInitialSessionPermissions(true)).resolves.toBeUndefined();
		expect(permissionsQuery).not.toHaveBeenCalled();
	});

	it("leaves a session the API rejects (401) to the client", async () => {
		permissionsQuery.mockImplementation(() => failedQuery(httpFailure(401)));

		await expect(loadWebInitialSessionPermissions(true)).resolves.toBeUndefined();
	});

	it("rethrows an API outage instead of silently painting an empty sidebar", async () => {
		permissionsQuery.mockImplementation(() => failedQuery({ kind: "unreachable", cause: "ECONNREFUSED" }));

		await expect(loadWebInitialSessionPermissions(true)).rejects.toThrow("auth.permissions failed during server render: network (ECONNREFUSED)");
	});
});
