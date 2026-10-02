import type { QueryClient } from "@tanstack/react-query";

import { invalidateSessionAuth } from "../session/invalidate-auth";
import type { ApiClient } from "../../api/use-api";
import type { ApiRouter } from "../../api/endpoints";
import type { AuthCommands } from "../../features/auth/facade";

/** The session commands the post-verification sync drives (`useAuthCommands()`). */
export type EmailVerificationSessionCommands = Pick<AuthCommands, "login" | "markEmailVerified" | "refreshSession">;

/** The two session reads it needs (`useAuth().api` satisfies it). */
export interface EmailVerificationSessionApi {
	readonly auth: {
		readonly me: Pick<ApiClient<ApiRouter>["auth"]["me"], "fetchOrThrow">;
		readonly permissions: Pick<ApiClient<ApiRouter>["auth"]["permissions"], "fetchOrThrow">;
	};
}

/**
 * Rotates the httpOnly session after email verification so access tokens pick up
 * `isEmailVerified` / `sessionScope: full` from the database, then re-reads the
 * session. Runs from event handlers / effects with the provider's commands —
 * it never reaches into a store directly.
 */
export async function syncSessionAfterEmailVerification(api: EmailVerificationSessionApi, session: EmailVerificationSessionCommands, queryClient: QueryClient): Promise<void> {
	try {
		await session.refreshSession();
	} catch {
		// Guest may open the verify link without an active session.
	}

	await invalidateSessionAuth(queryClient);

	try {
		const [meResponse, permissionsResponse] = await Promise.all([api.auth.me.fetchOrThrow(undefined), api.auth.permissions.fetchOrThrow(undefined)]);
		// Establishes the session from the fresh answers (seeds the `/auth/me` cache too).
		session.login(meResponse.data, permissionsResponse.data);
	} catch {
		// The session could not be re-read: apply the known outcome to a signed-in tab (no-op otherwise).
		session.markEmailVerified();
	}
}
