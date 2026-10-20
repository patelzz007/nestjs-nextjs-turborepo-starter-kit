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

function userActor(accessScope: "tenant", isSuperAdmin = false): ActorContext {
	return ActorContextSchema.parse({
		kind: "user",
		userId: "user-1",
		sessionId: "session-1",
		tenantId: "org-1",
		isSuperAdmin,
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

	it("does not widen a superadmin beyond the tenant user's own session", () => {
		const scope = toRlsTransactionScope(userActor("tenant", true));
		expect(scope.context).toEqual(userRlsContext("user-1", "org-1", true));
		expect(scope.reason).toBeNull();
	});

	it("maps an API key onto its tenant and location", () => {
		const actor = ActorContextSchema.parse({
			kind: "api_key",
			apiKeyId: "key-1",
			tenantId: "org-1",
			locationId: "store-1",
			terminalId: "terminal-1",
			request: REQUEST,
		});
		expect(toRlsContext(actor)).toEqual(apiKeyRlsContext("key-1", "org-1", "store-1"));
	});

	it("maps an anonymous actor onto the resolved tenant and no principal", () => {
		const actor = ActorContextSchema.parse({ kind: "anonymous", tenantId: "org-1", request: REQUEST });
		expect(toRlsContext(actor)).toEqual(anonymousRlsContext("org-1"));
	});

	it("maps a system actor onto its operation, tenant, acting user, and audit reason", () => {
		const actor = systemActor("outbox.enqueue", "job", "org-1", "Enqueue a domain event", "user-9");
		const scope = toRlsTransactionScope(actor);
		expect(scope.context).toEqual(systemRlsContext("outbox.enqueue", "user-9", "org-1"));
		expect(scope.reason).toBe("Enqueue a domain event");
	});

	it("maps a refresh-token subject onto its own user without requiring a tenant", () => {
		const actor = ActorContextSchema.parse({ kind: "token_subject", userId: "user-9", tenantId: null, request: REQUEST });
		expect(toRlsTransactionScope(actor)).toEqual({ context: userRlsContext("user-9", null, false), reason: null });
	});

	it("strips a stray route-bypass flag from an actor, so it cannot widen the scope", () => {
		const user = ActorContextSchema.parse({ ...userActor("tenant"), routeRlsBypass: true });
		const anonymous = ActorContextSchema.parse({ kind: "anonymous", tenantId: null, request: REQUEST, routeRlsBypass: true });

		expect(Object.keys(user)).not.toContain("routeRlsBypass");
		expect(Object.keys(anonymous)).not.toContain("routeRlsBypass");

		expect(toRlsTransactionScope(user)).toEqual({ context: userRlsContext("user-1", "org-1", true), reason: null });
		expect(toRlsContext(anonymous)).toEqual(anonymousRlsContext(null));
	});
});

describe("toRlsTransactionScope options", () => {
	const customer: ActorContext = ActorContextSchema.parse({
		kind: "user",
		userId: "user-1",
		sessionId: "session-1",
		tenantId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: REQUEST,
	});

	it("requires the tenant for tenant data (the default)", () => {
		expect(toRlsTransactionScope(customer).context).toMatchObject({ kind: "user", tenantId: null, requireExplicitContext: true });
		expect(toRlsTransactionScope(customer, TENANT_DATA_SCOPE).context).toMatchObject({ requireExplicitContext: true });
	});

	it("needs no tenant for the user's own rows", () => {
		expect(toRlsTransactionScope(customer, USER_OWNED_DATA_SCOPE).context).toMatchObject({
			kind: "user",
			userId: "user-1",
			tenantId: null,
			requireExplicitContext: false,
		});
	});

	it("applies the own-rows option to a superadmin and leaves a system actor on its operation", () => {
		expect(toRlsTransactionScope(userActor("tenant", true), USER_OWNED_DATA_SCOPE).context).toMatchObject({ kind: "user", requireExplicitContext: false });
		expect(toRlsTransactionScope(systemActor("outbox.enqueue", "job", "org-1", "Enqueue a domain event", "user-9"), USER_OWNED_DATA_SCOPE).context.kind).toBe("system");
	});
});
