import { ForbiddenException } from "@nestjs/common";

/**
 * Consistent authorization error — 403 Forbidden.
 *
 * Never reveals which permission or role was missing.
 * All authorization failures throw this single exception.
 */
export class AuthorizationException extends ForbiddenException {
	public constructor() {
		super("You do not have permission to perform this action.");
	}
}
