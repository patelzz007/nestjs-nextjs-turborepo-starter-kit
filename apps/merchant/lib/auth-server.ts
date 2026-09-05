import "server-only";

import { decodeJwtPayload } from "@workspace/client/lib/auth/jwt";
import { cookies } from "next/headers";
import { z } from "zod";

const ACCESS_TOKEN_COOKIE = "merchantAccessToken";

const ServerUserPayloadSchema = z.object({
	fullName: z.string(),
	email: z.string(),
});

const ServerImpersonationPayloadSchema = z.object({
	isImpersonating: z.boolean().optional(),
});

/** SSR-painted sidebar/topbar identity — validated via Zod (no `typeof`). */
export const ServerUserSchema = z.object({
	name: z.string().min(1),
	email: z.string(),
});

export type ServerUser = z.output<typeof ServerUserSchema>;

export interface MerchantServerSession {
	readonly user: ServerUser | null;
	readonly isImpersonating: boolean;
}

/** Decodes merchant JWT cookie for SSR shell identity + impersonation banner. */
export async function getMerchantServerSession(): Promise<MerchantServerSession> {
	const cookieStore = await cookies();
	const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
	if (token === undefined) {
		return { user: null, isImpersonating: false };
	}

	const payload = decodeJwtPayload(token);
	if (payload === null) {
		return { user: null, isImpersonating: false };
	}

	const userParsed = ServerUserPayloadSchema.safeParse(payload);
	const impersonationParsed = ServerImpersonationPayloadSchema.safeParse(payload);

	return {
		user: userParsed.success ? { name: userParsed.data.fullName, email: userParsed.data.email } : null,
		isImpersonating: impersonationParsed.success && impersonationParsed.data.isImpersonating === true,
	};
}
