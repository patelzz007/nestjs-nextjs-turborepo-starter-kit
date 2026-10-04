import "server-only";

import { settleServerQuery } from "@/lib/api/server-query-outcome";
import { hasServerAccessSession } from "@/lib/auth/server";
import { createWebServerCaller } from "@/lib/web-server-api";
import type { Envelope, SessionPermissionsResponse } from "@workspace/shared";

/**
 * The SSR `GET /auth/permissions` envelope (data AND the server's answer time,
 * which seeds the client query) for first-paint sidebar
 * filtering, or `undefined` when the server cannot know them yet — no session,
 * a refresh-only session, or one the API no longer accepts (401). The client
 * then resolves them itself (after the proxy or the client refreshes the
 * session). Any other failure is unexpected: it is logged and rethrown, so the
 * app's error boundary renders it instead of a silently empty sidebar. The
 * response is validated against its contract by the SSR caller.
 */
export async function loadWebInitialSessionPermissions(sessionActive: boolean): Promise<Envelope<SessionPermissionsResponse> | undefined> {
	if (!sessionActive || !(await hasServerAccessSession())) {
		return undefined;
	}

	const [result] = await Promise.allSettled([createWebServerCaller().auth.permissions.query(undefined)]);
	const permissions = settleServerQuery(result, { label: "auth.permissions", expected: ["unauthenticated"] });
	return permissions.kind === "ok" ? permissions.data : undefined;
}
