import "server-only";

import { z } from "zod";

import { classifyError, type PrefetchFailure, type ServerCaller } from "../../../api/server-api";
import { expectedFailureKind, UnexpectedServerQueryError } from "../../../api/server-query-outcome";
import type { ServerRenderedSession } from "./server-rendered-session";

/** A server query rejects with an `Error`; anything else is classified as an unexplained failure. */
const RejectionReasonSchema = z.instanceof(Error);

/** What the loader reads: the two session queries of a server caller (any `ServerCaller` is one). */
export interface ServerSessionReader {
	readonly auth: Pick<ServerCaller["auth"], "me" | "permissions">;
}

/** Writes an unexpected failure to the server log. */
export type ServerSessionFailureLogger = (message: string) => void;

function logToConsole(message: string): void {
	console.error(message);
}

/**
 * What the server learned about this request's session:
 * - `signed-in` — the API described it (`/auth/me` and `/auth/permissions`);
 * - `signed-out` — there is none the server can use: no session cookie, or an
 *   access token the API rejects (401). It may still be recoverable — only the
 *   browser (or the proxy) can refresh an expired token, since a server
 *   render cannot write cookies;
 * - `unavailable` — no answer (API down, timeout, 5xx, a broken contract). Not
 *   a fact about the session: it is logged, and carries the error so the app
 *   applies its own outage policy — render its error page (`throw
 *   outcome.error`), or render and let the browser's session check settle it.
 */
export type ServerSessionOutcome =
	| { readonly kind: "signed-in"; readonly session: ServerRenderedSession }
	| { readonly kind: "signed-out" }
	| { readonly kind: "unavailable"; readonly error: UnexpectedServerQueryError };

type SettledAnswer<TData> =
	{ readonly kind: "ok"; readonly data: TData } | { readonly kind: "signed-out" } | { readonly kind: "unavailable"; readonly error: UnexpectedServerQueryError };

/** The cause recorded when a query rejected with something that is not an `Error`. */
const NON_ERROR_REJECTION_MESSAGE = "the request rejected with a non-Error value";

function settledAnswer<TData>(result: PromiseSettledResult<TData>, label: string, log: ServerSessionFailureLogger): SettledAnswer<TData> {
	if (result.status === "fulfilled") {
		return { kind: "ok", data: result.value };
	}
	const parsedReason = RejectionReasonSchema.safeParse(result.reason);
	const reason: Error | undefined = parsedReason.success ? parsedReason.data : undefined;
	const failure: PrefetchFailure = classifyError(reason);
	if (expectedFailureKind(failure) === "unauthenticated") {
		return { kind: "signed-out" };
	}
	const error = new UnexpectedServerQueryError(label, failure, reason ?? new Error(NON_ERROR_REJECTION_MESSAGE));
	log(`[auth] ${error.message}`);
	return { kind: "unavailable", error };
}

/**
 * Asks the API about this request's session — `GET /auth/me` and
 * `GET /auth/permissions` in parallel, with the request's cookies: the same
 * two answers the browser's session check reads. A session needs both (a
 * profile without its permissions would be a session of unknown scope); the
 * two calls carry the same cookies, so they describe the same session.
 *
 * The answers are UI state only — every API call is still authorized by the
 * API. Call it once per request (`React.cache` in the app) and share it
 * between the root layout (`AuthProvider` `serverSession`) and any layout
 * that needs the permissions.
 */
export async function loadServerSessionOutcome(server: ServerSessionReader, log: ServerSessionFailureLogger = logToConsole): Promise<ServerSessionOutcome> {
	const [profileResult, permissionsResult] = await Promise.allSettled([server.auth.me.query(undefined), server.auth.permissions.query(undefined)]);
	const profile = settledAnswer(profileResult, "auth.me", log);
	const permissions = settledAnswer(permissionsResult, "auth.permissions", log);
	if (profile.kind === "signed-out" || permissions.kind === "signed-out") {
		return { kind: "signed-out" };
	}
	if (profile.kind === "unavailable") {
		return profile;
	}
	if (permissions.kind === "unavailable") {
		return permissions;
	}
	return { kind: "signed-in", session: { profile: profile.data, permissions: permissions.data } };
}

/** The session to start the auth store from, or `undefined` when the server has none to offer. */
export function serverRenderedSessionOf(outcome: ServerSessionOutcome): ServerRenderedSession | undefined {
	return outcome.kind === "signed-in" ? outcome.session : undefined;
}
