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
