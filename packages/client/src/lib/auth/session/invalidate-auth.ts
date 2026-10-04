import type { QueryClient } from "@tanstack/react-query";

import { apiRouter } from "../../api/endpoints";

/**
 * Re-reads the signed-in member's own session data after something changed it
 * server-side for the SAME identity (e.g. an admin edited their own roles):
 * the profile (`/auth/me`), the session's permissions and scope
 * (`/auth/permissions`) and the organization memberships + capabilities.
 * Keys come from the endpoint registry, so they always match the queries.
 *
 * An IDENTITY change (sign-in, impersonation start/stop) is not an
 * invalidation: it goes through the auth commands (`login`), which clear the
 * whole cache of the previous identity.
 */
export async function invalidateSessionAuth(queryClient: QueryClient): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: apiRouter.auth.me.scopeKey(undefined) }),
		queryClient.invalidateQueries({ queryKey: apiRouter.auth.permissions.scopeKey(undefined) }),
		queryClient.invalidateQueries({ queryKey: apiRouter.organizations.membershipsBootstrap.scopeKey(undefined) }),
	]);
}
