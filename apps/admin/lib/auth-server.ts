import "server-only";

import { decodeJwtPayload } from "@workspace/client/lib/auth/edge/jwt";
import { loadServerSessionOutcome, type ServerSessionOutcome } from "@workspace/client/lib/auth/session/load-server-session";
import { AUTH_COOKIE_NAMES } from "@workspace/shared";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";

import { createAdminServerCaller } from "@/lib/admin-server-api";

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

const ACCESS_TOKEN_COOKIE = AUTH_COOKIE_NAMES.admin.accessToken;

/** The access-token claims the sidebar needs — validated via zod (no `typeof`). */
const ServerUserPayloadSchema = z.object({
	fullName: z.string(),
	email: z.string(),
});

/** The SSR-painted identity — schema-derived (rule 5). */
export const ServerUserSchema = z.object({
	name: z.string().min(1),
	email: z.string(),
});

export type ServerUser = z.output<typeof ServerUserSchema>;

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

/**
 * This request's session as the API describes it (`/auth/me` +
 * `/auth/permissions`), asked once per request (`React.cache`): the root
 * layout starts the auth store from it, so the first paint already knows who
 * is signed in (super-admin navigation included), and the panel layout takes
 * its permissions from the same answer.
 */
export const loadAdminServerSession = cache((): Promise<ServerSessionOutcome> => loadServerSessionOutcome(createAdminServerCaller()));
