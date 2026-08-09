import "server-only";

import { decodeJwtPayload } from "@workspace/client/lib/jwt";
import { cookies } from "next/headers";
import { z } from "zod";

/**
 * Server-side identity for the admin shell, decoded from the httpOnly
 * `adminAccessToken` cookie (the proxy writes it; browser JS can't read it).
 *
 * Purpose: let SSR paint the REAL user's name/email in the sidebar and topbar
 * instead of a placeholder — the shell no longer waits for `GET /auth/me` to
 * render the dashboard chrome. `/auth/me` still runs on the client and stays
 * the source of truth (it refreshes roles/permissions and detects a dead
 * session), but the initial HTML already contains the right identity.
 *
 * Only the fields the sidebar needs are decoded; the token is NOT verified
 * here (same trade-off as the proxy) — a tampered/expired token is rejected by
 * the API on the next authenticated call, and worst case the stale name/email
 * flashes for a moment before `/auth/me` corrects it.
 */

const ACCESS_TOKEN_COOKIE = "adminAccessToken";

/** The access-token claims the sidebar needs — validated via zod (no `typeof`). */
const ServerUserPayloadSchema = z.object({
	fullName: z.string(),
	email: z.string(),
});

export interface ServerUser {
	readonly name: string;
	readonly email: string;
}

/** Reads the admin access-token cookie and decodes `{ name, email }` from the JWT. */
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
