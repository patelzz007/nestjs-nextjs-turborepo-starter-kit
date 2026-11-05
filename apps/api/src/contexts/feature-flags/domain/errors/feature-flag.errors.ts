import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/** The merchant does not exist, or the branch is not one of its branches (enhancement 5.11). */
export class FeatureFlagStoreNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_FLAG_STORE_NOT_FOUND";

	public constructor(
		public readonly tenantId: string,
		public readonly locationId: string | null,
	) {
		super("That store was not found.", { tenantId, locationId });
	}
}

/** No live per-store setting with that id for this flag. */
export class FeatureFlagOverrideNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_FLAG_OVERRIDE_NOT_FOUND";

	public constructor(public readonly overrideId: string) {
		super("That store setting was not found.", { overrideId });
	}
}
