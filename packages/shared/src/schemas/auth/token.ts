import { z } from "zod";

import { PermissionDetailsSchema, SlimRoleSchema } from "./user";

/**
 * Flattened user object used internally by `TokenService` to generate JWT tokens.
 * Contains both user metadata and their full permission context.
 */
export const FlatUserResponseSchema = z
	.object({
		id: z.string(),
		email: z.string(),
		fullName: z.string(),
		isActive: z.boolean(),
		isSuperAdmin: z.boolean(),
		isEmailVerified: z.boolean(),
		hasAdminAccess: z.boolean(),
		tokenVersion: z.number(),
		roles: z.array(SlimRoleSchema),
		permissions: z.array(PermissionDetailsSchema),
	})
	.strict();

export type FlatUserResponse = z.output<typeof FlatUserResponseSchema>;

/**
 * The shape embedded in the JWT access token payload.
 *
 * ## Authorization design
 *
 * The JWT carries **identity + lightweight flags** — no permission lists,
 * no role lists.  Full permission resolution happens at guard time via
 * `AuthorizationCheckerService`, so role/permission changes take effect
 * on the next request without token regeneration.
 *
 * `hasAdminAccess` is a pre-computed boolean included because the
 * Next.js proxy (`proxy.ts`) runs server-side on every navigation and
 * needs a fast, synchronous way to gate admin panel routes without an
 * async DB call.  It is NOT a substitute for the guard-level RBAC
 * check — the API enforces fine-grained permissions.
 *
 * @see AuthorizationCheckerService — resolves effective permissions
 * @see AuthorizationGuard — enforces route-level authorization
 */
export const AccessTokenPayloadSchema = z.object({
	sub: z.string(),
	id: z.string(),
	email: z.string(),
	fullName: z.string(),
	isActive: z.boolean(),
	isSuperAdmin: z.boolean(),
	isEmailVerified: z.boolean(),
	hasAdminAccess: z.boolean(),
	// Incremented on role/permission mutations. The guard rejects tokens
	// with a stale version, forcing re-auth after authorization changes.
	tokenVersion: z.number(),
	isImpersonating: z.boolean().optional(),
	originalUserId: z.string().optional(),
	iat: z.number().optional(),
	exp: z.number().optional(),
});

export type AccessTokenPayload = z.output<typeof AccessTokenPayloadSchema>;

/** The shape embedded in the refresh token JWT payload. */
export const RefreshTokenPayloadSchema = z.object({
	sub: z.string(),
	email: z.string(),
	jti: z.string(),
	tokenType: z.literal("refresh"),
	iat: z.number(),
	exp: z.number(),
});

export type RefreshTokenPayload = z.output<typeof RefreshTokenPayloadSchema>;

/** Payload signed for email verification links. */
export const EmailVerificationTokenPayloadSchema = z.object({
	sub: z.string(),
	purpose: z.literal("email_verification"),
});

export type EmailVerificationTokenPayload = z.output<typeof EmailVerificationTokenPayloadSchema>;
