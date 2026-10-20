import type { Envelope, SessionPermissionsResponse, UserResponse } from "@workspace/shared";

/**
 * The session the server rendered the page for: the API's own answers to
 * `GET /auth/me` and `GET /auth/permissions`, made with the request's session
 * cookies during the server render (`loadServerRenderedSession`). The same
 * two answers the browser's session check reads — so the auth store can start
 * from them (`AuthProvider` `serverSession`) and the first paint already shows
 * everything that depends on who is signed in.
 *
 * Whole envelopes, so the seeded queries carry the server's real answer time
 * (`meta`) and refetch on their usual schedule. Never a token.
 */
export interface ServerRenderedSession {
	readonly profile: Envelope<UserResponse>;
	readonly permissions: Envelope<SessionPermissionsResponse>;
}
