import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** The claims unit of work (`UnitOfWork<ClaimsScope>`). */
export const CLAIMS_UNIT_OF_WORK = Symbol("CLAIMS_UNIT_OF_WORK");

/** {@link ClaimReadPort}. */
export const CLAIM_READS = Symbol("CLAIM_READS");

/** {@link RewardNotificationReadPort}. */
export const REWARD_NOTIFICATION_READS = Symbol("REWARD_NOTIFICATION_READS");

/** {@link ClaimCodesPort}. */
export const CLAIM_CODES = Symbol("CLAIM_CODES");

/** {@link ClaimIdGenerator}. */
export const CLAIM_ID_GENERATOR = Symbol("CLAIM_ID_GENERATOR");

/**
 * The operation the `@RlsBypass()` claim routes (request OTP, claim) run under: a claim reserves
 * stock on a reward the customer cannot update under RLS, so their transaction is an allowlisted
 * system operation, exactly as the route's interceptor already names it.
 */
export const ROUTE_RLS_BYPASS_OPERATION: SystemOperationName = "route.rls_bypass";

/** Generates ids for new claims and challenges. */
export interface ClaimIdGenerator {
	next(): string;
}
