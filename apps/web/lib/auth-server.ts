import "server-only";

import { hasRouteSession } from "@workspace/client/lib/auth/proxy-refresh";
import { decodeJwtPayload } from "@workspace/client/lib/auth/jwt";
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

/** True when the browser sent a recoverable session (live access or refresh token). */
export async function hasServerSession(): Promise<boolean> {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
	return hasRouteSession(accessToken, refreshToken, accessToken);
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
