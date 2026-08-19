import { z } from "zod";

import { PermissionDetailsSchema, SlimRoleSchema } from "./user";

/**
 * Slim permission shape embedded in the JWT access token.
 * Excludes `id` and `description` to keep the JWT under ~4 KB cookie size limit.
 *
 * Deliberately NOT `.strict()`: this schema runs inside
 * `AccessTokenPayloadSchema.parse()` on every token verification. A strict
 * sub-schema would turn "we added a claim to the JWT" into a total auth
 * outage — unknown keys are stripped instead, keeping the decode defensive.
 */
export const JwtPermissionSchema = z.object({
	action: z.string(),
	resource: z.string(),
});

export type JwtPermission = z.output<typeof JwtPermissionSchema>;

/** Permission context returned by `RbacService.getUserPermissions()`. */
export const UserPermissionsSchema = z
	.object({
		roles: z.array(SlimRoleSchema),
		permissions: z.array(PermissionDetailsSchema),
	})
	.strict();

export type UserPermissions = z.output<typeof UserPermissionsSchema>;

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
		roles: z.array(SlimRoleSchema),
		permissions: z.array(PermissionDetailsSchema),
	})
	.strict();

export type FlatUserResponse = z.output<typeof FlatUserResponseSchema>;

/**
 * The shape embedded in the JWT access token payload.
 * Permissions use the ultra-slim `JwtPermission` type so the JWT stays under
 * the browser cookie size limit (~4 KB).
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
	roles: z.array(SlimRoleSchema),
	permissions: z.array(JwtPermissionSchema),
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
