import type { EpochMs } from "@workspace/shared";

/**
 * The customers the nightly review looks at (ADR 085): everyone above Bronze (only they can be warned or demoted), and
 * everyone who redeemed since `recentSince` (a promotion whose evaluation just after the redemption was missed).
 */
export interface TierReviewCandidatesPort {
	/** The next `limit` such user ids after `afterUserId` (null: from the start), in id order, each once. */
	page(afterUserId: string | null, limit: number, recentSince: EpochMs): Promise<readonly string[]>;
}
