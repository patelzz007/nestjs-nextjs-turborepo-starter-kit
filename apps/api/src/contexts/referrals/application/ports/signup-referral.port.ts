import type { SignupReferralStatus } from "@workspace/shared";

/** Signup referrals as identity's signup needs them (ADR 035), exported through referrals' public API. */

/** A referral code that passed validation before the signup transaction; re-checked inside it. */
export interface AcceptedSignupReferral {
	readonly canonical: string;
	readonly referrerUserId: string;
	readonly referralCodeId: string;
}

/** The referral facts the admin user list and profile show for one referee. */
export interface SignupReferralSummary {
	readonly referrer: { readonly id: string; readonly fullName: string };
	readonly status: SignupReferralStatus;
}

/** Work outside any transaction. */
export interface SignupReferralPort {
	/**
	 * Validates a submitted code before the taken-email check, so a bad code is never disguised as a
	 * successful registration. `null` when no code was submitted. Throws a validation error otherwise.
	 */
	acceptCodeForSignup(raw: string | null | undefined, clientType: string | undefined): Promise<AcceptedSignupReferral | null>;
	/** Batched summaries per referee id (admin user list, one read). */
	summariesForReferees(refereeUserIds: readonly string[]): Promise<ReadonlyMap<string, SignupReferralSummary>>;
	summaryForReferee(refereeUserId: string): Promise<SignupReferralSummary | null>;
}

/** Work bound to the caller's transaction (the signup or provisioning unit of work); bound per transaction by the consumer's scope factory. */
export interface TransactionalSignupReferralPort {
	/** Every account has a referral code from creation on. */
	issueFirstCode(userId: string, now: number): Promise<void>;
	/** Attaches the accepted referral to the new account, re-validating the code inside this transaction. */
	attachSignupReferral(accepted: AcceptedSignupReferral, referee: { readonly id: string; readonly createdAt: number }): Promise<void>;
}
