import { DomainError } from "./domain-error";

/** The caller is authenticated but the authorization kernel refused the action. */
export class AuthorizationDeniedError extends DomainError {
	public readonly code = "PERMISSION_DENIED";

	public constructor(action: string, resource: string) {
		super("You do not have permission to perform this action.", { action, resource });
	}
}
