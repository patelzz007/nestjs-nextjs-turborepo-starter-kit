import { describe, expect, it } from "vitest";

import { actingInTenant, ActorContextSchema, systemActor, type ActorContext } from "../actor-context";

const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

describe("actingInTenant", () => {
	it("re-binds a signed-in user to the verified tenant, leaving everything else as it was", () => {
		const user: ActorContext = {
			kind: "user",
			userId: "user-1",
			sessionId: "session-1",
			tenantId: null,
			isSuperAdmin: false,
			accessScope: "tenant",
			impersonatorUserId: null,
			request: REQUEST,
		};

		expect(actingInTenant(user, "org-1")).toEqual({ ...user, tenantId: "org-1" });
		expect(user.tenantId).toBeNull();
	});

	it("never re-binds an API key, which is bound to its own tenant", () => {
		const key: ActorContext = { kind: "api_key", apiKeyId: "key-1", tenantId: "org-9", locationId: null, terminalId: null, request: REQUEST };

		expect(actingInTenant(key, "org-1")).toBe(key);
	});
});

describe("systemActor", () => {
	it("accepts a registered operation name and origin", () => {
		const actor = systemActor("queue.email.send", "job", "org-1", "Deliver a queued email", null);

		expect(actor).toEqual({
			kind: "system",
			operation: "queue.email.send",
			origin: "job",
			tenantId: "org-1",
			actorUserId: null,
			reason: "Deliver a queued email",
		});
	});

	// The parameter types already refuse these at compile time; the schema is the runtime contract for actors read from untyped input.
	it("rejects an unknown operation name", () => {
		const result = ActorContextSchema.safeParse({ kind: "system", operation: "not.a.real.operation", origin: "cli", tenantId: null, actorUserId: null, reason: "cli" });

		expect(result.success).toBe(false);
	});

	it("rejects an unknown origin", () => {
		const result = ActorContextSchema.safeParse({
			kind: "system",
			operation: "queue.email.send",
			origin: "websocket",
			tenantId: null,
			actorUserId: null,
			reason: "socket",
		});

		expect(result.success).toBe(false);
	});

	it("rejects a blank audit reason", () => {
		expect(() => systemActor("queue.email.send", "job", null, "", null)).toThrow();
	});
});
