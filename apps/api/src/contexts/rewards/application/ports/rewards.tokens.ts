import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** The rewards unit of work (`UnitOfWork<RewardsScope>`). */
export const REWARDS_UNIT_OF_WORK = Symbol("REWARDS_UNIT_OF_WORK");

/** {@link RewardReadPort}. */
export const REWARD_READS = Symbol("REWARD_READS");

/** {@link RewardImageDeliveryPort}. */
export const REWARD_IMAGE_DELIVERY = Symbol("REWARD_IMAGE_DELIVERY");

/** {@link LegalAcceptanceReadPort}. */
export const LEGAL_ACCEPTANCE_READS = Symbol("LEGAL_ACCEPTANCE_READS");

/** {@link IdGenerator}. */
export const REWARD_ID_GENERATOR = Symbol("REWARD_ID_GENERATOR");

/**
 * The operation `@RlsBypass()` routes run under. Admin review and the public marketplace work
 * across tenants; their commands and reads open their transactions as this allowlisted operation,
 * the same one the route's interceptor names.
 */
export const ROUTE_RLS_BYPASS_OPERATION: SystemOperationName = "route.rls_bypass";

/** Generates ids for new aggregates (a fake makes them deterministic in tests). */
export interface IdGenerator {
	next(): string;
}
