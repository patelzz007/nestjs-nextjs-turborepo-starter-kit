import type { ActorContext } from "../../../../platform/application/actor-context";
import { systemActor } from "../../../../platform/application/actor-context";

export const MERCHANT_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const API_KEY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

/** A signed-in person (merchant member, reviewer or customer). */
export function userActor(userId: string = MERCHANT_USER_ID): ActorContext {
	return { kind: "user", userId, sessionId: "session-1", organizationId: null, isSuperAdmin: false, accessScope: "tenant", impersonatorUserId: null, request: REQUEST };
}

export function apiKeyActor(organizationId: string): ActorContext {
	return { kind: "api_key", apiKeyId: API_KEY_ID, organizationId, locationId: null, terminalId: null, request: REQUEST };
}

export function jobActor(): ActorContext {
	return systemActor("queue.rewards.auto_publish", "job", null, "Publish rewards whose review window has elapsed", null);
}
