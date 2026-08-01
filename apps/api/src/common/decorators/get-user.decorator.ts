import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { AccessTokenPayload, RefreshTokenPayload } from "../../modules/auth/services/token.service";

/**
 * Custom parameter decorator that extracts the authenticated user (or a specific
 * user property) from `request.user`.
 *
 * Uses the `in` operator to narrow the union type (`AccessTokenPayload | RefreshTokenPayload`)
 * so no type assertions or `unknown` are needed.
 *
 * Usage:
 * ```typescript
 * // Get the full user payload
 * @GetUser() user: AccessTokenPayload
 *
 * // Get a specific property
 * @GetUser("sub") userId: string
 * ```
 */
export const GetUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext): AccessTokenPayload | RefreshTokenPayload | string | boolean | undefined => {
	const request: Request = ctx.switchToHttp().getRequest<Request>();
	const user: AccessTokenPayload | RefreshTokenPayload | undefined = request.user;

	if (!user || !data) return user;

	// Both payload types share `sub` and `email`
	if (data === "sub") return user.sub;
	if (data === "email") return user.email;

	// AccessTokenPayload-specific properties
	if ("id" in user && data === "id") return user.id;
	if ("fullName" in user && data === "fullName") return user.fullName;
	if ("isActive" in user && data === "isActive") return user.isActive;
	if ("isSuperAdmin" in user && data === "isSuperAdmin") return user.isSuperAdmin;
	if ("isEmailVerified" in user && data === "isEmailVerified") return user.isEmailVerified;
	if ("originalUserId" in user && data === "originalUserId") return user.originalUserId;

	// RefreshTokenPayload-specific properties
	if ("jti" in user && data === "jti") return user.jti;
	if ("tokenType" in user && data === "tokenType") return user.tokenType;

	return undefined;
});
