import "server-only";

import { hasRouteSession } from "@workspace/client/lib/auth/edge/proxy-refresh";
import { decodeJwtPayload } from "@workspace/client/lib/auth/edge/jwt";
import { cookies } from "next/headers";
import { z } from "zod";

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";

const ServerUserPayloadSchema = z.object({
	fullName: z.string(),
	email: z.string(),
});

export const ServerUserSchema = z.object({
	name: z.string().min(1),
	email: z.string(),
});

export type ServerUser = z.output<typeof ServerUserSchema>;

/** True when the browser sent a recoverable session (a refresh-token cookie; see `hasRouteSession`). */
export async function hasServerSession(): Promise<boolean> {
	const cookieStore = await cookies();
	const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
	return hasRouteSession(refreshToken);
}

/**
 * True when the browser sent BOTH an access token and a refresh token — a
 * session a server page can call the API with right now. An expired access
 * token still counts: the SSR caller refreshes it on the API's 401. A
 * refresh-only session (the access cookie is gone) does not: only the proxy
 * can rotate cookies, and it does so on the login route, which then returns
 * the user to the page.
 */
export async function hasServerAccessSession(): Promise<boolean> {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
	return accessToken !== undefined && hasRouteSession(refreshToken);
}

/** Reads the web access-token cookie and decodes sidebar identity for SSR. */
export async function getServerUser(): Promise<ServerUser | null> {
	const cookieStore = await cookies();
	const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
	if (token === undefined) {
		return null;
	}

	const payload = decodeJwtPayload(token);
	if (payload === null) {
		return null;
	}

	const parsed = ServerUserPayloadSchema.safeParse(payload);
	if (!parsed.success) {
		return null;
	}

	return { name: parsed.data.fullName, email: parsed.data.email };
}
