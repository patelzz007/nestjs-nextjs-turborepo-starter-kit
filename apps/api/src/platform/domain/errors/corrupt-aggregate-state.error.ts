import { DomainError } from "./domain-error";
import type { DomainErrorCode } from "./error-codes";

/**
 * Stored data violates an aggregate invariant (an unknown status, a half-written field pair), so the
 * mapper refuses to rehydrate it instead of building an invalid aggregate (§spec-7.3, migration plan
 * §5.7). One error for every context: it answers `CORRUPT_AGGREGATE_STATE` (500) and names the aggregate.
 */
export class CorruptAggregateStateError extends DomainError {
	public readonly code: DomainErrorCode = "CORRUPT_AGGREGATE_STATE";

	/**
	 * @param aggregate the aggregate's name (`reward`, `user_account`, `SupportAccessGrant`, …)
	 * @param aggregateId the row's id, or `null` when the invariant is about a value not yet stored
	 * @param reason what is wrong, for the log (never client data)
	 */
	public constructor(aggregate: string, aggregateId: string | null, reason: string | null = null) {
		super(`Stored ${aggregate} state cannot be loaded.`, { aggregate, aggregateId, reason });
	}
}
