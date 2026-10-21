import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** {@link SignupReferralPort} (identity's signup and admin user list). */
export const SIGNUP_REFERRALS = Symbol("SIGNUP_REFERRALS");
/** {@link SignupReferralReadPort}. */
export const SIGNUP_REFERRAL_READS = Symbol("SIGNUP_REFERRAL_READS");
/** {@link SignupReferralCodeMaintenancePort}. */
export const SIGNUP_REFERRAL_CODE_MAINTENANCE = Symbol("SIGNUP_REFERRAL_CODE_MAINTENANCE");
/** `SignupReferralAuditFactory`: provided by rewards (it owns the audit trail), bound to the code job's transaction. */
export const SIGNUP_REFERRAL_AUDIT_FACTORY = Symbol("SIGNUP_REFERRAL_AUDIT_FACTORY");

/** The `maintenance.signup_referral_codes` system operation, named once for every route and adapter that runs under it. */
export const MAINTENANCE_SIGNUP_REFERRAL_CODES_OPERATION: SystemOperationName = "maintenance.signup_referral_codes";
/** `ReferableRewardLookupFactory`: provided by rewards (it owns `Reward`). */
export const REFERABLE_REWARD_LOOKUP_FACTORY = Symbol("REFERABLE_REWARD_LOOKUP_FACTORY");
/** `RefereeAttributionFactory`: provided by identity (it owns `User`). */
export const REFEREE_ATTRIBUTION_FACTORY = Symbol("REFEREE_ATTRIBUTION_FACTORY");
/** {@link RewardReferralLinkTransactions}. */
export const REWARD_REFERRAL_LINK_TRANSACTIONS = Symbol("REWARD_REFERRAL_LINK_TRANSACTIONS");
/** {@link ReferralLinkIdentityGenerator}. */
export const REFERRAL_LINK_IDENTITY_GENERATOR = Symbol("REFERRAL_LINK_IDENTITY_GENERATOR");

/** The `referrals.reward_link.create` system operation. */
export const CREATE_REWARD_REFERRAL_LINK_OPERATION: SystemOperationName = "referrals.reward_link.create";
/** The `referrals.attribution.record` system operation. */
export const RECORD_REWARD_REFERRAL_ATTRIBUTION_OPERATION: SystemOperationName = "referrals.attribution.record";
