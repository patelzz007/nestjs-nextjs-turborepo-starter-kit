import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

interface RequestWithUser {
	user?: {
		isEmailVerified?: boolean;
		email?: string;
	};
}

/**
 * Guard that enforces email verification on protected routes.
 *
 * Apply this guard to routes that require a verified email address
 * (e.g. creating API keys, accessing sensitive settings).
 *
 * The `isEmailVerified` flag is set on the user payload by the AuthGuard
 * after successful authentication, based on the `emailVerifiedAt` timestamp.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<RequestWithUser>();

		if (!request.user) {
			throw new ForbiddenException("User not authenticated");
		}

		if (!request.user.isEmailVerified) {
			throw new ForbiddenException({
				message: "Email verification required. Please verify your email address before accessing this resource.",
				error: "EMAIL_NOT_VERIFIED",
			});
		}

		return true;
	}
}
