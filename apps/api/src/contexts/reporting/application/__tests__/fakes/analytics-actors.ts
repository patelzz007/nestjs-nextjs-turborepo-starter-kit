import type { ActorContext } from "../../../../../platform/application/actor-context";

const REQUEST = { requestId: "req-analytics", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

/** A signed-in tenant user. */
export function userActor(userId: string): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session-1",
		organizationId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: REQUEST,
		routeRlsBypass: false,
	};
}

/** A merchant API key of `organizationId`. */
export function apiKeyActor(apiKeyId: string, organizationId: string): ActorContext {
	return { kind: "api_key", apiKeyId, organizationId, locationId: null, terminalId: null, request: REQUEST, routeRlsBypass: false };
}

/** An anonymous caller (no analytics of its own). */
export function anonymousActor(): ActorContext {
	return { kind: "anonymous", organizationId: null, request: REQUEST, routeRlsBypass: false };
}
