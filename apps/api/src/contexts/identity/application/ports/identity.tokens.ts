import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Whether an email already belongs to an account. Reads `User` only. */
export const ACCOUNT_LOOKUP_OPERATION: SystemOperationName = "auth.account.lookup";
/** The platform admin user list and one account's security fields. Reads `User` only. */
export const ADMIN_USERS_READ_OPERATION: SystemOperationName = "auth.admin_users.read";
/** A platform administrator clears another account's lockout. Writes `User` only. */
export const ADMIN_USERS_UNLOCK_OPERATION: SystemOperationName = "auth.admin_users.unlock";
/** Count a failed password and request the lockout email. */
export const LOGIN_FAILURE_OPERATION: SystemOperationName = "auth.login.record_failure";
/** Clear the failed-attempt counter after a successful password. */
export const LOGIN_LOCKOUT_RESET_OPERATION: SystemOperationName = "auth.login.clear_lockout";
/** Open the two-factor challenge after a matching password. */
export const LOGIN_CHALLENGE_OPERATION: SystemOperationName = "auth.login.open_challenge";
/** Read the account and request the emailed new-device login code. */
export const LOGIN_DEVICE_CODE_OPERATION: SystemOperationName = "auth.login.request_device_code";
/** Consume a passed second factor and stamp MFA assurance. */
export const LOGIN_MFA_COMPLETE_OPERATION: SystemOperationName = "auth.login.complete_mfa";
/** Count a wrong authenticator code, and lock the account when the challenge is exhausted. */
export const LOGIN_MFA_FAILURE_OPERATION: SystemOperationName = "auth.login.record_mfa_failure";
/** Store a new session and sweep expired ones. */
export const SESSION_ISSUE_OPERATION: SystemOperationName = "auth.session.issue";
/** Issue a password-reset link. */
export const PASSWORD_RESET_REQUEST_OPERATION: SystemOperationName = "auth.password_reset.request";
/** Read whether a password-reset link is still usable. */
export const PASSWORD_RESET_LOOKUP_OPERATION: SystemOperationName = "auth.password_reset.lookup";
/** Consume a reset link, replace the password, and sign out every session. */
export const PASSWORD_RESET_COMPLETE_OPERATION: SystemOperationName = "auth.password_reset.complete";
/** Create a signup account, its first referral code, the default role, and the verification email. */
export const SIGNUP_REGISTER_OPERATION: SystemOperationName = "auth.signup.register";
/** Request the verification email for an unverified account. */
export const EMAIL_VERIFICATION_SEND_OPERATION: SystemOperationName = "auth.email_verification.send";
/** Mark an account's email verified. */
export const EMAIL_VERIFICATION_CONFIRM_OPERATION: SystemOperationName = "auth.email_verification.confirm";
/** Open an impersonation session for a SuperAdmin. */
export const IMPERSONATION_START_OPERATION: SystemOperationName = "auth.impersonation.start";
/** End an impersonation session and restore the administrator. */
export const IMPERSONATION_STOP_OPERATION: SystemOperationName = "auth.impersonation.stop";
/** A user edits their own profile (the HTTP audit row is written in the same bypass transaction). */
export const OWN_PROFILE_UPDATE_OPERATION: SystemOperationName = "auth.profile.update";
/** Why a profile edit runs under {@link OWN_PROFILE_UPDATE_OPERATION}. */
export const OWN_PROFILE_UPDATE_REASON = "User edits their own profile";
export const MFA_RECOVERY_LIST_OPERATION: SystemOperationName = "auth.mfa_recovery.list";
export const MFA_RECOVERY_REQUEST_OPERATION: SystemOperationName = "auth.mfa_recovery.request";
export const MFA_RECOVERY_REVIEW_OPERATION: SystemOperationName = "auth.mfa_recovery.review";
export const MFA_RECOVERY_UNLOCK_OPERATION: SystemOperationName = "maintenance.mfa_recovery_unlock";
export const PASSWORD_RESET_CLEANUP_OPERATION: SystemOperationName = "maintenance.password_reset_token_cleanup";
export const AUTHORIZATION_CHANGE_SWEEP_OPERATION: SystemOperationName = "maintenance.authorization_change_sweep";
export const SUPERADMIN_BOOTSTRAP_OPERATION: SystemOperationName = "auth.superadmin.bootstrap";

export const IDENTITY_UNIT_OF_WORK = Symbol("IDENTITY_UNIT_OF_WORK");
export const CREDENTIAL_CRYPTO = Symbol("CREDENTIAL_CRYPTO");
export const IDENTITY_TOKENS = Symbol("IDENTITY_TOKENS");
export const AUTHENTICATOR = Symbol("AUTHENTICATOR");
export const TOTP_SECRET_CIPHER = Symbol("TOTP_SECRET_CIPHER");
export const LOGIN_VERIFICATION_STORE = Symbol("LOGIN_VERIFICATION_STORE");
export const USER_SESSION_CACHE = Symbol("USER_SESSION_CACHE");
export const AUTHORIZATION_CHANGE_FEED = Symbol("AUTHORIZATION_CHANGE_FEED");
export const SESSION_LOCATION_LOOKUP = Symbol("SESSION_LOCATION_LOOKUP");
export const ACCESS_TOKEN_INVALIDATION = Symbol("ACCESS_TOKEN_INVALIDATION");
export const AUTH_FLOW_SUBJECT = Symbol("AUTH_FLOW_SUBJECT");
export const IDENTITY_TELEMETRY = Symbol("IDENTITY_TELEMETRY");
export const MERCHANT_PORTAL_ACCESS = Symbol("MERCHANT_PORTAL_ACCESS");
export const IDENTITY_SETTINGS = Symbol("IDENTITY_SETTINGS");
export const ID_GENERATOR = Symbol("ID_GENERATOR");
/** Memberships of an impersonation target, and the administrator's approved support grants. */
export const IMPERSONATION_TENANT_FACTS = Symbol("IMPERSONATION_TENANT_FACTS");
export const IDENTITY_READ = Symbol("IDENTITY_READ");
/** {@link RegistrationSignInPort} (tenants' team-invite registration). */
export const REGISTRATION_SIGN_IN = Symbol("REGISTRATION_SIGN_IN");
