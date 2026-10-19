import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Public credential flows (signup, login, reset, …) run under the `@RlsBypass()` route operation, as the RLS interceptor records it. */
export const PUBLIC_AUTH_FLOW_OPERATION: SystemOperationName = "route.rls_bypass";
/** A user edits their own profile (the HTTP audit row is written in the same bypass transaction). */
export const OWN_PROFILE_UPDATE_OPERATION: SystemOperationName = "auth.profile.update";
/** Why a profile edit runs under {@link OWN_PROFILE_UPDATE_OPERATION}. */
export const OWN_PROFILE_UPDATE_REASON = "User edits their own profile";
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
export const IDENTITY_READ = Symbol("IDENTITY_READ");
/** {@link RegistrationSignInPort} (organizations' team-invite registration). */
export const REGISTRATION_SIGN_IN = Symbol("REGISTRATION_SIGN_IN");
