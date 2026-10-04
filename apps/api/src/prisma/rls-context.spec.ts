import { describe, expect, it } from "vitest";

import { MissingTenantContextError } from "./missing-tenant-context.error";
import {
	anonymousRlsContext,
	apiKeyRlsContext,
	currentRlsContext,
	currentRlsContextOrUnscoped,
	rlsSessionVariables,
	rlsStorage,
	runWithSystemRlsContext,
	systemRlsContext,
	userRlsContext,
} from "./rls-context";
import { isAllowlistedSystemOperation, parseSystemOperation, SystemOperationNotAllowlistedError } from "./system-operation.registry";

describe("rls-context", () => {
	it("fails closed outside any scope: no bypass, no user, no organization, the default role", () => {
		expect(currentRlsContextOrUnscoped()).toEqual({
			kind: "anonymous",
			userId: null,
			bypass: false,
			organizationId: null,
			requireExplicitContext: false,
			systemOperation: null,
			role: "app_runtime",
		});
		expect(() => currentRlsContext()).toThrow(MissingTenantContextError);
	});

	it("returns the open scope when one exists", () => {
		const scope = userRlsContext("user-1", "org-a", true);

		rlsStorage.run(scope, () => {
			expect(currentRlsContextOrUnscoped()).toBe(scope);
		});
	});

	it("grants bypass only to allowlisted system operations, with the operation's role", () => {
		expect(systemRlsContext("queue.email.send")).toEqual(expect.objectContaining({ bypass: true, systemOperation: "queue.email.send", role: "app_runtime" }));
		expect(systemRlsContext("tenant.enumerate")).toEqual(expect.objectContaining({ bypass: true, systemOperation: "tenant.enumerate", role: "app_enumerator" }));
	});

	it("encodes a missing user / organization as '' only at the SQL session-variable layer", () => {
		expect(rlsSessionVariables(anonymousRlsContext(null))).toEqual({
			role: "app_runtime",
			currentUserId: "",
			currentOrganizationId: "",
			rlsBypass: "false",
			systemOperation: "",
			currentApiKeyId: "",
			currentApiKeyLocationId: "",
		});
		expect(rlsSessionVariables(systemRlsContext("queue.email.send"))).toEqual({
			role: "app_runtime",
			currentUserId: "",
			currentOrganizationId: "",
			rlsBypass: "true",
			systemOperation: "queue.email.send",
			currentApiKeyId: "",
			currentApiKeyLocationId: "",
		});
		expect(rlsSessionVariables(userRlsContext("user-1", "org-a", true))).toEqual({
			role: "app_runtime",
			currentUserId: "user-1",
			currentOrganizationId: "org-a",
			rlsBypass: "false",
			systemOperation: "",
			currentApiKeyId: "",
			currentApiKeyLocationId: "",
		});
		expect(systemRlsContext("queue.email.send").userId).toBeNull();
	});

	it("makes a verified API key a machine principal of its own organization (and store): no user, no bypass", () => {
		expect(apiKeyRlsContext("key-1", "org-a", "store-1")).toEqual({
			kind: "api_key",
			apiKeyId: "key-1",
			organizationId: "org-a",
			apiKeyLocationId: "store-1",
			userId: null,
			bypass: false,
			requireExplicitContext: false,
			systemOperation: null,
			role: "app_runtime",
		});
		expect(rlsSessionVariables(apiKeyRlsContext("key-1", "org-a", "store-1"))).toEqual({
			role: "app_runtime",
			currentUserId: "",
			currentOrganizationId: "org-a",
			rlsBypass: "false",
			systemOperation: "",
			currentApiKeyId: "key-1",
			currentApiKeyLocationId: "store-1",
		});
		// An organization-wide key has no store scope.
		expect(rlsSessionVariables(apiKeyRlsContext("key-2", "org-a", null)).currentApiKeyLocationId).toBe("");
	});

	it("rejects a name that is not allowlisted when it arrives untyped (configuration, JSON)", () => {
		const configured: string = ["anything", "goes"].join(".");
		expect(() => parseSystemOperation(configured)).toThrow(SystemOperationNotAllowlistedError);
		expect(isAllowlistedSystemOperation(configured)).toBe(false);
	});

	it("runs background work inside a named system scope", async () => {
		const observed = await runWithSystemRlsContext("maintenance.permission_expiry", async () => {
			await Promise.resolve();
			return currentRlsContextOrUnscoped();
		});

		expect(observed).toEqual(expect.objectContaining({ bypass: true, systemOperation: "maintenance.permission_expiry" }));
		expect(currentRlsContextOrUnscoped().bypass).toBe(false);
	});
});
