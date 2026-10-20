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
 * A claim reserves stock on a reward the customer cannot update under RLS, so the checkout
 * transactions are named operations rather than the route-wide bypass.
 */
export const CLAIM_OTP_REQUEST_OPERATION: SystemOperationName = "claims.otp.request";
/** Reserve one unit and store the claim. */
export const CLAIM_REWARD_OPERATION: SystemOperationName = "claims.reward.claim";

/** Generates ids for new claims and challenges. */
export interface ClaimIdGenerator {
	next(): string;
}
