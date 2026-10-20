/*
 * The ONLY file other contexts may import from referrals (plan §6.4).
 *
 * - `SIGNUP_REFERRALS` (`SignupReferralPort`): validate a signup's referral code before the signup
 *   transaction; batched referrer summaries for the admin user list. Provided by `ReferralsModule`.
 * - `createReferralsTransactionalPorts(db)`: the first code and the signup referral, written in
 *   identity's signup / provisioning transaction; the reward-referral attribution of a referee's
 *   claim; the referrer-credit email bookkeeping. Only your `infrastructure/` may call it.
 * - `createReferralCreditPort(db, events, bonusStock)`: `ReferralCreditPort`, the checkout's referrer
 *   credit and signup-referral success stamp, in the checkout's transaction (pos).
 * - Public events `ReferrerCredited` (claims issues the credit claim and inbox notice in the same
 *   transaction, and the email after commit) and `SignupReferralSucceeded` (claims delivers the
 *   referrer's notice after commit, claiming it through `signupSuccessNotices`).
 * - `SIGNUP_REFERRAL_AUDIT_FACTORY` (`SignupReferralAuditFactory`): the code job's audit trail, which
 *   referrals CONSUMES and rewards provides (referrals imports no context).
 */
export type { AcceptedSignupReferral, SignupReferralPort, SignupReferralSummary, TransactionalSignupReferralPort } from "./application/ports/signup-referral.port";
export type { ReferralBonusStockPort, ReferralCreditPort, ReferrerBonus } from "./application/ports/referral-credit.port";
export type { ReferrerCreditCursor, ReferrerCreditNoticesPort, UnnotifiedReferrerCredit } from "./application/ports/referrer-credit-notices.port";
export type { RewardReferralAttributionPort } from "./application/ports/reward-referral-attribution.port";
export type { IssuedSignupReferralCode, SignupReferralAuditPort } from "./application/ports/signup-referral-audit.port";
export type { ClaimedSignupSuccessNotice, OwedSignupSuccessNotice, SignupSuccessNoticesPort } from "./application/ports/signup-success-notices.port";
export type { SignupReferralAuditFactory } from "./infrastructure/persistence/prisma-signup-referral-jobs";
export { SIGNUP_REFERRAL_AUDIT_FACTORY, SIGNUP_REFERRALS } from "./application/ports/referrals.tokens";
export { createReferralCreditPort, createReferralsTransactionalPorts, type ReferralsTransactionalPorts } from "./infrastructure/persistence/referrals-transactional-ports";
export { ReferrerCredited, SignupReferralSucceeded } from "./domain/events/referral.events";
export { REFERRER_CLAIM_TTL_DAYS } from "./domain/policies/referrer-credit.policy";

// ── The Nest module (a leaf: platform dependencies only) ─────────────────────
export { ReferralsModule } from "./referrals.module";
