import { describe, expect, it } from "vitest";

import { ActorContextSchema, systemActor, type ActorContext } from "../../../application/actor-context";
import { anonymousRlsContext, apiKeyRlsContext, systemRlsContext, userRlsContext } from "../../../../prisma/rls-context";
import { toRlsContext, toRlsTransactionScope, TENANT_DATA_SCOPE, USER_OWNED_DATA_SCOPE } from "../actor-to-rls-context";

const REQUEST = {
	requestId: "corr-1",
	ip: null,
	userAgent: null,
	deviceLabel: null,
	endpoint: null,
};

function userActor(accessScope: "tenant" | "superadmin" | "staff_single_tenant"): ActorContext {
	return ActorContextSchema.parse({
		kind: "user",
		userId: "user-1",
		sessionId: "session-1",
		organizationId: "org-1",
		isSuperAdmin: accessScope === "superadmin",
		accessScope,
		impersonatorUserId: null,
		request: REQUEST,
	});
}

describe("toRlsTransactionScope", () => {
	it("maps a tenant user onto a non-bypass user context", () => {
		expect(toRlsContext(userActor("tenant"))).toEqual(userRlsContext("user-1", "org-1", true));
		expect(toRlsTransactionScope(userActor("tenant")).reason).toBeNull();
	});

	it("maps a superadmin onto the platform.superadmin bypass, keeping the user and organization", () => {
		const scope = toRlsTransactionScope(userActor("superadmin"));
		expect(scope.context).toEqual(systemRlsContext("platform.superadmin", "user-1", "org-1"));
		expect(scope.reason).toBe("platform.superadmin");
	});

	it("maps single-tenant staff onto the staff bypass", () => {
		const scope = toRlsTransactionScope(userActor("staff_single_tenant"));
		expect(scope.context).toEqual(systemRlsContext("platform.staff_single_tenant", "user-1", "org-1"));
		expect(scope.reason).toBe("platform.staff_single_tenant");
	});

	it("maps an API key onto its organization and location", () => {
		const actor = ActorContextSchema.parse({
			kind: "api_key",
			apiKeyId: "key-1",
			organizationId: "org-1",
			locationId: "store-1",
			terminalId: "terminal-1",
			request: REQUEST,
		});
		expect(toRlsContext(actor)).toEqual(apiKeyRlsContext("key-1", "org-1", "store-1"));
	});

	it("maps an anonymous actor onto the resolved organization and no principal", () => {
		const actor = ActorContextSchema.parse({ kind: "anonymous", organizationId: "org-1", request: REQUEST });
		expect(toRlsContext(actor)).toEqual(anonymousRlsContext("org-1"));
	});

	it("maps a system actor onto its operation, organization, acting user, and audit reason", () => {
		const actor = systemActor("outbox.enqueue", "job", "org-1", "Enqueue a domain event", "user-9");
		const scope = toRlsTransactionScope(actor);
		expect(scope.context).toEqual(systemRlsContext("outbox.enqueue", "user-9", "org-1"));
		expect(scope.reason).toBe("Enqueue a domain event");
	});

	it("maps a refresh-token subject onto its own user without requiring an organization", () => {
		const actor = ActorContextSchema.parse({ kind: "token_subject", userId: "user-9", organizationId: null, request: REQUEST });
		expect(toRlsTransactionScope(actor)).toEqual({ context: userRlsContext("user-9", null, false), reason: null });
	});

	it("maps any HTTP actor on an @RlsBypass() route onto route.rls_bypass, before its own scope", () => {
		const user = ActorContextSchema.parse({ ...userActor("tenant"), routeRlsBypass: true });
		const anonymous = ActorContextSchema.parse({ kind: "anonymous", organizationId: null, request: REQUEST, routeRlsBypass: true });

		expect(toRlsTransactionScope(user)).toEqual({ context: systemRlsContext("route.rls_bypass", "user-1", "org-1"), reason: "route.rls_bypass" });
		expect(toRlsContext(anonymous)).toEqual(systemRlsContext("route.rls_bypass", null, null));
	});
});

describe("toRlsTransactionScope options", () => {
	const customer: ActorContext = ActorContextSchema.parse({
		kind: "user",
		userId: "user-1",
		sessionId: "session-1",
		organizationId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: REQUEST,
	});

	it("requires the organization for tenant data (the default)", () => {
		expect(toRlsTransactionScope(customer).context).toMatchObject({ kind: "user", organizationId: null, requireExplicitContext: true });
		expect(toRlsTransactionScope(customer, TENANT_DATA_SCOPE).context).toMatchObject({ requireExplicitContext: true });
	});

	it("needs no organization for the user's own rows", () => {
		expect(toRlsTransactionScope(customer, USER_OWNED_DATA_SCOPE).context).toMatchObject({
			kind: "user",
			userId: "user-1",
			organizationId: null,
			requireExplicitContext: false,
		});
	});

	it("never relaxes a superadmin's or a system scope", () => {
		expect(toRlsTransactionScope(userActor("superadmin"), USER_OWNED_DATA_SCOPE).context.kind).toBe("system");
	});
});
