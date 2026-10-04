import type { WebSessionState } from "@/components/auth/web-authorization-provider";
import { epochMs, SessionPermissionsResponseSchema, type CapabilitySlug, type Envelope, type SessionPermissionsResponse } from "@workspace/shared";

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
		// A full (non-enrollment) session — the state every signed-in fixture describes.
		sessionScope: "full",
	});
}

/** When the fixture API answered — `meta.timestamp` of fixture envelopes. */
export const FIXTURE_ANSWERED_AT = epochMs(1_790_000_000_000);

/** The `GET /auth/permissions` envelope the server prefetch returns (real meta shape). */
export function sessionPermissionsEnvelope(permissions: SessionPermissionsResponse): Envelope<SessionPermissionsResponse> {
	return { success: true, data: permissions, meta: { correlationId: "fixture", timestamp: FIXTURE_ANSWERED_AT } };
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
