import type { EpochMs } from "@workspace/shared";

import type { MfaRecoveryRequest } from "../aggregates/mfa-recovery-request.aggregate";

/** MFA recovery requests, bound to one unit-of-work transaction. */
export interface MfaRecoveryRequestRepository {
	/** Transaction-scoped advisory lock per user: concurrent opens of a recovery for the same user run one at a time. */
	lockOpeningFor(userId: string): Promise<void>;

	/** Whether the user has a PENDING or APPROVED request. */
	hasOpenRequest(userId: string): Promise<boolean>;

	findById(id: string): Promise<MfaRecoveryRequest | null>;

	/** Ids of APPROVED requests whose security delay has elapsed at `now`. */
	findDueApprovedIds(now: EpochMs): Promise<readonly string[]>;

	add(request: MfaRecoveryRequest): Promise<void>;

	/**
	 * Writes a transition: compare-and-set on the loaded status (zero rows throws
	 * `MfaRecoveryNotPendingError` for a review), then its audit rows. A completion also clears the
	 * user's second factor (secret, backup codes, pending setup) and moves `tokenVersion`, attributing
	 * the backup-code soft delete to the approving SuperAdmin. Returns `false` when a completion lost
	 * the compare-and-set (another worker completed it).
	 */
	save(request: MfaRecoveryRequest): Promise<boolean>;
}
