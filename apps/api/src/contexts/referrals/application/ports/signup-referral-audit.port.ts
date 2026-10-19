/** One signup referral code the hourly code job issued (ADR 035, "Authorization and audit"): the owner and the row, never the code value. */
export interface IssuedSignupReferralCode {
	readonly ownerUserId: string;
	readonly referralCodeId: string;
	/** True when it replaced an expired code, false for the account's first. */
	readonly successor: boolean;
}

/**
 * Where the code job records each code it issues, bound to the job's transaction. Referrals owns no
 * audit table: rewards provides this (its `RewardAuditLog`) under `SIGNUP_REFERRAL_AUDIT_FACTORY`,
 * so referrals stays a leaf that imports no context (identity depends on it).
 */
export interface SignupReferralAuditPort {
	recordCodeIssued(issued: IssuedSignupReferralCode): Promise<void>;
}
