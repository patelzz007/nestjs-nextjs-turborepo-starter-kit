import type { ActorContext } from "../../../../../platform/application/actor-context";

const REQUEST = { requestId: "req-analytics", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

/** A signed-in tenant user. */
export function userActor(userId: string): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session-1",
		tenantId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: REQUEST,
	};
}

/** A merchant API key of `tenantId`. */
export function apiKeyActor(apiKeyId: string, tenantId: string): ActorContext {
	return { kind: "api_key", apiKeyId, tenantId, locationId: null, terminalId: null, request: REQUEST };
}

/** An anonymous caller (no analytics of its own). */
export function anonymousActor(): ActorContext {
	return { kind: "anonymous", tenantId: null, request: REQUEST };
}
