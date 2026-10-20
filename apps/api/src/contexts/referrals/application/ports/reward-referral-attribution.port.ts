/**
 * Ties a referee's first claim of a reward to the reward referral that brought them, inside the claim's
 * transaction (claims calls it through `createReferralsTransactionalPorts(db)`).
 */
export interface RewardReferralAttributionPort {
	/** The PENDING referral of `rewardId` behind `attributionToken`, now naming the referee; `null` when there is none. */
	attachReferee(attributionToken: string, rewardId: string, refereeUserId: string): Promise<string | null>;
}
