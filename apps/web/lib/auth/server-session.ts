import "server-only";

import type { ServerRenderedSession } from "@workspace/client/lib/auth";
import { loadServerSessionOutcome } from "@workspace/client/lib/auth/session/load-server-session";

import { hasServerAccessSession } from "@/lib/auth/server";
import { createWebServerCaller } from "@/lib/web-server-api";

/**
 * The session this request carries, as the API describes it (`/auth/me` +
 * `/auth/permissions`), for the root layout: the auth store starts from it and
 * the authorization provider takes its permissions from it, so the first
 * paint already knows who is signed in and what they may do.
 *
 * `undefined` when the server cannot know it yet — a guest, a refresh-only
 * session (no access cookie: only the proxy can rotate cookies), or a session
 * the API no longer accepts (401); the browser then resolves it. Neither of
 * the first two calls the API. Any other failure (API down, timeout, 5xx, a
 * broken contract) is logged and rethrown, so the app's error boundary renders
 * it instead of a page built from a missing session.
 */
export async function loadWebServerSession(sessionActive: boolean): Promise<ServerRenderedSession | undefined> {
	if (!sessionActive || !(await hasServerAccessSession())) {
		return undefined;
	}

	const outcome = await loadServerSessionOutcome(createWebServerCaller());
	switch (outcome.kind) {
		case "signed-in":
			return outcome.session;
		case "signed-out":
			return undefined;
		case "unavailable":
			throw outcome.error;
	}
}
