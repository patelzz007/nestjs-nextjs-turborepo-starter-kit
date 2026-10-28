import { DomainError } from "./domain-error";
import type { DomainErrorCode } from "./error-codes";

/**
 * A load-test user (ADR 068) exists only inside the Load Test tenant: it can never hold a platform
 * role, and never become a member of any other tenant. Both writes that could do it (role
 * assignment, membership) refuse with this, whatever path led there.
 */
export class LoadTestUserConfinedError extends DomainError {
	public readonly code: DomainErrorCode = "LOAD_TEST_USER_CONFINED";

	public constructor(public readonly userId: string) {
		super("A load-test user can only be a member of the Load Test tenant, and can never hold a platform role", { userId });
	}
}
