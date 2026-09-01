import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { AuthenticatedUser } from "../../../types/authenticated-user";
import { isAuthenticatedUser } from "../../../types/authenticated-user";

export type { AuthenticatedUser };

function extractUser(ctx: ExecutionContext): AuthenticatedUser {
	const request: FastifyRequest = ctx.switchToHttp().getRequest<FastifyRequest>();

	if (!isAuthenticatedUser(request.user)) {
		throw new UnauthorizedException("User not authenticated");
	}

	return request.user;
}

/**
 * Param decorator that extracts the full authenticated user from the request.
 *
 * ```ts
 * @Get('profile')
 * async getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
	return extractUser(ctx);
});

/**
 * Param decorator that extracts just the user ID from the request.
 *
 * ```ts
 * @Get('profile')
 * async getProfile(@CurrentUserId() userId: string) {
 *   return this.userService.getProfile(userId);
 * }
 * ```
 */
export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
	return extractUser(ctx).id;
});
