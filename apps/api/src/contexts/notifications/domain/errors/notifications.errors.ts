import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/**
 * A stored `EmailLog.status` is not one of the six statuses (D32). The
 * column is TEXT, so this is the one place a corrupt value is caught: the
 * mapper refuses to build an email log from it instead of guessing (§spec-7.3).
 */
export class CorruptEmailLogStateError extends DomainError {
	public readonly code: DomainErrorCode = "CORRUPT_AGGREGATE_STATE";

	public constructor(emailLogId: string) {
		super("Stored email log status cannot be loaded.", { aggregateId: emailLogId });
	}
}
