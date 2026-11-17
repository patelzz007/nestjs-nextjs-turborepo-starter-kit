import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/** Tiers are off for this deployment (the `customer-tiers` flag), so there is no tier page to show. */
export class TiersDisabledError extends DomainError {
	public readonly code: DomainErrorCode = "TIERS_DISABLED";

	public constructor() {
		super("Tiers are not available.");
	}
}
