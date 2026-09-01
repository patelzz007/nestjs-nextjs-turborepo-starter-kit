import { z } from "zod";

import { EpochMsSchema } from "../api/common";

/**
 * Minimal "session status" payload returned by `GET /session`.
 *
 * This is the deliberate "very basic protected API": it proves the request
 * carried a valid access token (the global AuthGuard rejects it with 401
 * otherwise) and answers "who am I + when does my token die" with **zero
 * database work** — every field is read straight off the verified JWT.
 *
 * The client uses it to render a live "token expires in …" countdown, which
 * makes the silent-refresh flow observable: after a 401→refresh→retry the
 * `expiresAt` visibly jumps forward by `JWT_ACCESS_EXPIRY`.
 */
export const SessionStatusSchema = z
	.object({
		userId: z.string().meta({
			description: "The authenticated user's id (JWT `sub`)",
			example: "cm0abcdef1234567890",
		}),
		email: z.email().meta({
			description: "The authenticated user's email (JWT `email`)",
			example: "admin@example.com",
		}),
		fullName: z.string().meta({
			description: "The authenticated user's full name (JWT `fullName`)",
			example: "Alex Morgan",
		}),
		expiresAt: EpochMsSchema.nullable().meta({
			description: "Epoch ms when the current access token expires (JWT `exp`), or null when the token carries no expiry",
			example: 1786300000000,
		}),
		checkedAt: EpochMsSchema.meta({
			description: "Epoch ms when this status was produced (server clock)",
			example: 1786300000000,
		}),
	})
	.strict();

export type SessionStatus = z.output<typeof SessionStatusSchema>;
