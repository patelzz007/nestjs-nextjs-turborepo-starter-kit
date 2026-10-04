import type { ApiClient } from "../../api/use-api";
import type { ApiRouter } from "../../api/endpoints";
import type { AuthCommands } from "../../features/auth/facade";
import { catchCaught } from "../../caught";

/** The session commands the post-verification sync drives (`useAuthCommands()`). */
export type EmailVerificationSessionCommands = Pick<AuthCommands, "login" | "refreshSession">;

/** The session read it needs (`useAuth().api` satisfies it). */
export interface EmailVerificationSessionApi {
	readonly auth: {
		readonly me: Pick<ApiClient<ApiRouter>["auth"]["me"], "fetchOrThrow">;
	};
}

/**
 * How the session sync after a verified email ended:
 * - `synced` — the session was rotated (the new access token carries the
 *   verified flag / new scope) and re-read; the tab now shows it;
 * - `no-session` — there is no session to update in this browser (a guest
 *   opened the link, or this tab already signed out);
 * - `unavailable` — the API could not be reached for the rotation or the
 *   re-read. Nothing about the session was assumed; the caller offers a retry.
 */
export type EmailVerificationSyncResult = "synced" | "no-session" | "unavailable";

/**
 * Rotates the httpOnly session after email verification so the access token
 * picks up `isEmailVerified` / `sessionScope` from the database, then re-reads
 * the profile and establishes it (the scope is re-read from
 * `/auth/permissions` by the facade). The rotation goes through the tab's
 * SINGLE-FLIGHT refresh (`refreshSession`), so it can never race another
 * refresh of the same refresh token. Nothing is applied without a server
 * answer.
 */
export async function syncSessionAfterEmailVerification(api: EmailVerificationSessionApi, session: EmailVerificationSessionCommands): Promise<EmailVerificationSyncResult> {
	const refreshed = await session.refreshSession();
	if (refreshed === "expired") {
		return "no-session";
	}
	if (refreshed === "transient") {
		return "unavailable";
	}

	return catchCaught(
		api.auth.me.fetchOrThrow(undefined).then((me): EmailVerificationSyncResult => {
			session.login(me.data, me.meta);
			return "synced";
		}),
		(): EmailVerificationSyncResult => "unavailable",
	);
}
