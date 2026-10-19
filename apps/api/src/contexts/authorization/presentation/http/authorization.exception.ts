import { ForbiddenException } from "@nestjs/common";

/**
 * Consistent authorization error — 403 Forbidden.
 *
 * Never reveals which permission, role, scope, or rule failed.
 * All authorization failures throw this single exception.
 */
export class AuthorizationException extends ForbiddenException {
	public constructor() {
		super({ message: "You do not have permission to perform this action.", error: "PERMISSION_DENIED" });
	}
}
