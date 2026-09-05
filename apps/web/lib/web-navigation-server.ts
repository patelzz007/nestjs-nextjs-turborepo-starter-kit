import "server-only";

import { createWebServerCaller } from "@/lib/web-server-api";
import { SessionPermissionsResponseSchema, type SessionPermissionsResponse } from "@workspace/shared";

/** SSR session capabilities from `GET /auth/permissions` for first-paint sidebar filtering. */
export async function loadWebInitialSessionPermissions(sessionActive: boolean): Promise<SessionPermissionsResponse | undefined> {
	if (!sessionActive) {
		return undefined;
	}

	try {
		const server = createWebServerCaller();
		const response = await server.auth.permissions.query(undefined);
		const parsed = SessionPermissionsResponseSchema.safeParse(response.data);
		if (parsed.success) {
			return parsed.data;
		}
	} catch {
		return undefined;
	}

	return undefined;
}
