import type { WebSessionState } from "@/components/auth/web-authorization-provider";
import { SessionPermissionsResponseSchema, type CapabilitySlug, type SessionPermissionsResponse } from "@workspace/shared";

export interface SessionFixtureOptions {
	readonly capabilities?: readonly CapabilitySlug[];
	readonly isImpersonating?: boolean;
}

/** Valid `GET /auth/permissions` payload for tests. */
export function buildSessionPermissions({ capabilities = [], isImpersonating = false }: SessionFixtureOptions = {}): SessionPermissionsResponse {
	return SessionPermissionsResponseSchema.parse({
		roles: [],
		permissions: [],
		tokenVersion: 1,
		hasAdminAccess: false,
		capabilities: [...capabilities],
		isImpersonating,
	});
}

/** Signed-in web session state with the given capabilities. */
export function signedInSession(options: SessionFixtureOptions = {}): WebSessionState {
	const session = buildSessionPermissions(options);
	return { isAuthenticated: true, isResolved: true, capabilities: session.capabilities, session };
}

/** Guest (anonymous) web session state — everything gated denies. */
export const GUEST_SESSION_STATE: WebSessionState = {
	isAuthenticated: false,
	isResolved: true,
	capabilities: [],
	session: undefined,
};
