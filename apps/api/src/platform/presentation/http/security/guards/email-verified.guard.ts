import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

/**
 * Guard that enforces email verification on protected routes.
 *
 * Apply via `@EmailVerified()` on mutations that must not run for unverified accounts
 * (impersonation, account unlock).
 *
 * `isEmailVerified` is set on the access-token payload by `TokenService`.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
	public canActivate(context: ExecutionContext): boolean {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;

		if (user === undefined) {
			throw new ForbiddenException({
				message: "User not authenticated",
				error: "UNAUTHENTICATED",
			});
		}

		if (!("isEmailVerified" in user) || !user.isEmailVerified) {
			throw new ForbiddenException({
				message: "Email verification required. Please verify your email address before accessing this resource.",
				error: "EMAIL_NOT_VERIFIED",
			});
		}

		return true;
	}
}
