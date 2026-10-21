import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

// Every identity error keeps the exact code and message the API answered before the DDD
// migration, and carries no details, so the ADR 016 envelope a client sees is unchanged.
// The HTTP status of each code lives in `domain-error-status.map.ts`.

/** The identity error codes, re-exported by `public-api.ts` for the HTTP status map. */
export const IDENTITY_ERROR_CODES = {
	invalidCredentials: "INVALID_CREDENTIALS",
	merchantAccessRequired: "MERCHANT_ACCESS_REQUIRED",
	badRequest: "BAD_REQUEST",
	unauthorized: "UNAUTHORIZED",
	forbidden: "FORBIDDEN",
	notFound: "NOT_FOUND",
	validation: "VALIDATION_ERROR",
	rateLimited: "RATE_LIMITED",
	mfaRecoverySelfReview: "MFA_RECOVERY_SELF_REVIEW",
	mfaRecoveryReviewerNotEligible: "MFA_RECOVERY_REVIEWER_NOT_ELIGIBLE",
	userNotFound: "USER_NOT_FOUND",
	accountInactive: "ACCOUNT_IS_INACTIVE",
	accountDeleted: "ACCOUNT_DELETED",
	refreshTokenInvalid: "REFRESH_TOKEN_INVALID",
	refreshTokenRevoked: "REFRESH_TOKEN_REVOKED",
	refreshTokenSuperseded: "REFRESH_TOKEN_SUPERSEDED",
	tokenTheftDetected: "TOKEN_THEFT_DETECTED",
	sessionNotFound: "SESSION_NOT_FOUND",
	sessionRevokeDuringImpersonation: "SESSION_REVOKE_DURING_IMPERSONATION",
	impersonationAlreadyActive: "IMPERSONATION_ALREADY_ACTIVE",
	impersonatorNotEligible: "IMPERSONATOR_NOT_ELIGIBLE",
	impersonationSessionInvalid: "IMPERSONATION_SESSION_INVALID",
	mfaStepUpRequired: "MFA_STEP_UP_REQUIRED",
	alreadyImpersonating: "ALREADY_IMPERSONATING",
	profileUpdateDuringImpersonation: "PROFILE_UPDATE_DURING_IMPERSONATION",
	superAdminAlreadyExists: "SUPERADMIN_ALREADY_EXISTS",
	bootstrapEmailTaken: "BOOTSTRAP_EMAIL_TAKEN",
	superAdminRoleMissing: "SUPERADMIN_ROLE_MISSING",
	corruptState: "CORRUPT_AGGREGATE_STATE",
	conflict: "CONFLICT",
	emailTaken: "EMAIL_TAKEN",
	banSelf: "USER_BAN_SELF",
	banSuperAdmin: "USER_BAN_SUPERADMIN",
	alreadyBanned: "USER_ALREADY_BANNED",
	notBanned: "USER_NOT_BANNED",
} satisfies Readonly<Record<string, DomainErrorCode>>;

/** The client-safe text of the password-history refusal (also asserted by the seed and tests). */
export const PASSWORD_REUSED_MESSAGE = "Password cannot be one of your last 5 passwords";

/** The one answer to every failed credential check: never tells which part was wrong. */
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

/** Client-safe reason sent with `PROFILE_UPDATE_DURING_IMPERSONATION`. */
export const PROFILE_UPDATE_DURING_IMPERSONATION_MESSAGE = "A profile cannot be changed during impersonation. Stop impersonating to edit your own profile.";

/** Client-safe reason sent with `SESSION_REVOKE_DURING_IMPERSONATION`. */
export const SESSION_REVOKE_DURING_IMPERSONATION_MESSAGE = "Devices cannot be signed out during impersonation. Stop impersonating first.";

// ── Accounts and credentials ────────────────────────────────────────────────

/** An address the shared email contract rejects (the HTTP layer validates first; this guards the domain). */
export class InvalidEmailAddressError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.validation;

	public constructor() {
		super("Invalid email address");
	}
}

/** A password the shared strength contract rejects. */
export class WeakPasswordError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.validation;

	public constructor() {
		super("The password does not meet the password policy");
	}
}

/** A failed sign-in: unknown email, wrong password, inactive, deleted or locked account. Indistinguishable on purpose. */
export class InvalidCredentialsError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.invalidCredentials;

	public constructor() {
		super(INVALID_CREDENTIALS_MESSAGE);
	}
}

/** Merchant portal sign-in by an account with no merchant membership, no pending team invite and no merchant-management grant. */
export class MerchantAccessRequiredError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.merchantAccessRequired;

	public constructor() {
		super("Merchant access required. This account is not linked to a merchant tenant.");
	}
}

/** The new password is one of the account's last {@link PASSWORD_REUSED_MESSAGE five}. */
export class PasswordReusedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super(PASSWORD_REUSED_MESSAGE);
	}
}

/** Change-password with a wrong current password. */
export class CurrentPasswordIncorrectError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Current password is incorrect");
	}
}

/** The signed-in account of a credential change no longer exists. */
export class CredentialAccountMissingError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("User not found");
	}
}

/** A reset token that is unknown, already used, expired or does not match its digest. */
export class PasswordResetTokenInvalidError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Invalid or expired reset token");
	}
}

/** Merchant onboarding with an existing account whose password does not match. */
export class InvalidOnboardingPasswordError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("Invalid password for this email address");
	}
}

/** The account addressed by id (or by a verified email token) does not exist. */
export class AccountNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.notFound;

	public constructor() {
		super("User not found");
	}
}

/** An admin tried to ban their own account. */
export class CannotBanSelfError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.banSelf;

	public constructor() {
		super("You cannot ban your own account");
	}
}

/** A platform operator's account (`isSuperAdmin`) cannot be banned through the API. */
export class CannotBanSuperAdminError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.banSuperAdmin;

	public constructor() {
		super("A SuperAdmin account cannot be banned");
	}
}

/** The account is already banned. */
export class AccountAlreadyBannedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.alreadyBanned;

	public constructor() {
		super("This account is already banned");
	}
}

/** Unban of an account that is not banned. */
export class AccountNotBannedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.notBanned;

	public constructor() {
		super("This account is not banned");
	}
}

/** A concurrent verification of the same address committed first (internal: the use case answers "already verified"). */
export class EmailAlreadyVerifiedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.conflict;

	public constructor() {
		super("Email already verified");
	}
}

/** A concurrent signup took the address between the availability check and the insert (internal: signup answers the generic response). */
export class EmailAlreadyRegisteredError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.emailTaken;

	public constructor() {
		super("An account with that email already exists");
	}
}

// ── Two-factor authentication ───────────────────────────────────────────────

export class TwoFactorAlreadyEnabledError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("Two-factor authentication is already enabled");
	}
}

export class TwoFactorSetupExpiredError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("2FA setup expired or not initiated");
	}
}

export class TwoFactorNotEnabledError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("Two-factor authentication is not enabled");
	}
}

/** The TOTP code presented to confirm an enrollment or a rotation is wrong (or replays a used step). */
export class InvalidTotpTokenError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Invalid 2FA token");
	}
}

/** 2FA rotation with a wrong account password. */
export class InvalidRotationPasswordError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Invalid password");
	}
}

/** A backup code that matches no unused code of the account, or lost a race to consume it. */
export class BackupCodeRejectedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Invalid or used backup code");
	}
}

export class TwoFactorNotEnabledForLoginError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Two-factor authentication is not enabled for this account");
	}
}

/** The account says 2FA is on but the encrypted secret columns are incomplete. */
export class TwoFactorNotConfiguredError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Two-factor authentication is not configured for this account");
	}
}

/** The TOTP code presented to complete a login is wrong, or its time step was already used (replay, D13). */
export class InvalidTwoFactorCodeError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Invalid 2FA code");
	}
}

/** The login challenge was consumed — by a concurrent completion too (D13). */
export class MfaChallengeAlreadyUsedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("MFA challenge has already been used");
	}
}

export class MfaChallengeExpiredError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("MFA challenge expired — sign in again");
	}
}

export class MfaChallengeAttemptsExhaustedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Too many MFA attempts — sign in again");
	}
}

/** The challenge named by a (validly signed) reference no longer exists. */
export class MfaChallengeNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Invalid or expired MFA challenge");
	}
}

/** A challenge reference of another purpose than the step completing it. */
export class MfaChallengePurposeMismatchError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Invalid MFA challenge");
	}
}

/** The challenge that was just created is gone before its reference was signed. */
export class MfaChallengeMissingError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("Invalid MFA challenge");
	}
}

// ── New-device login verification ───────────────────────────────────────────

export class LoginVerificationExpiredError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("Verification session expired or invalid");
	}
}

export class LoginVerificationAttemptsExceededError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.rateLimited;

	public constructor() {
		super("Too many verification attempts");
	}
}

export class InvalidLoginVerificationCodeError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Invalid verification code");
	}
}

/** The account a verification challenge was being created for vanished. */
export class LoginVerificationSessionInvalidError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Invalid verification session");
	}
}

// ── MFA recovery ────────────────────────────────────────────────────────────

export class MfaRecoveryRequiresTwoFactorError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("Two-factor authentication is not enabled on this account");
	}
}

export class MfaRecoveryAlreadyOpenError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("An MFA recovery request is already in progress");
	}
}

export class MfaRecoveryNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.notFound;

	public constructor() {
		super("MFA recovery request not found");
	}
}

/** The request is no longer PENDING — including a concurrent review that won the compare-and-set. */
export class MfaRecoveryNotPendingError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("Only pending MFA recovery requests can be reviewed");
	}
}

export class MfaRecoverySelfReviewError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.mfaRecoverySelfReview;

	public constructor() {
		super("You cannot review your own MFA recovery request — another super administrator must review it");
	}
}

export class MfaRecoveryReviewerNotEligibleError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.mfaRecoveryReviewerNotEligible;

	public constructor() {
		super("Only an active super administrator can review MFA recovery requests");
	}
}

// ── Device sessions ─────────────────────────────────────────────────────────

export class RefreshAccountMissingError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.userNotFound;

	public constructor() {
		super("User account no longer exists. Please log in again.");
	}
}

export class AccountInactiveError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.accountInactive;

	public constructor() {
		super("Account is inactive. Please contact support.");
	}
}

export class AccountDeletedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.accountDeleted;

	public constructor() {
		super("Account has been deleted. Please contact support.");
	}
}

/** The refresh token names no session of its subject, or the session can no longer be verified. */
export class RefreshTokenInvalidError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.refreshTokenInvalid;

	public constructor(message = "Invalid refresh token") {
		super(message);
	}
}

export class RefreshTokenExpiredError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.unauthorized;

	public constructor() {
		super("Refresh token has expired");
	}
}

export class RefreshTokenRevokedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.refreshTokenRevoked;

	public constructor() {
		super("Refresh token has been revoked. Please log in again.");
	}
}

/** A benign concurrent refresh: the presented token is the immediate predecessor, inside the grace window. */
export class RefreshTokenSupersededError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.refreshTokenSuperseded;

	public constructor() {
		super("Refresh token was already rotated. Please retry with the latest session.");
	}
}

/** A rotated refresh token was replayed: every session of the account was revoked. */
export class TokenTheftDetectedError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.tokenTheftDetected;

	public constructor() {
		super("Suspicious activity detected. All sessions have been revoked. Please log in again.");
	}
}

/** No device session with that id belongs to the caller (never 403: the id of someone else's session is not confirmed). */
export class DeviceSessionNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.sessionNotFound;

	public constructor() {
		super("Session not found.");
	}
}

/** An impersonation session tried to sign out one of the impersonated user's devices. */
export class SessionRevokeDuringImpersonationError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.sessionRevokeDuringImpersonation;

	public constructor() {
		super(SESSION_REVOKE_DURING_IMPERSONATION_MESSAGE);
	}
}

// ── Impersonation ───────────────────────────────────────────────────────────

export class ImpersonatorNotSuperAdminError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.forbidden;

	public constructor() {
		super("Only super administrators can impersonate users");
	}
}

export class CannotImpersonateSelfError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("Cannot impersonate yourself");
	}
}

export class ImpersonationTargetNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.notFound;

	public constructor() {
		super("Target user not found");
	}
}

export class ImpersonationTargetInactiveError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.badRequest;

	public constructor() {
		super("Cannot impersonate an inactive or deleted user");
	}
}

export class ImpersonationTargetSuperAdminError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.forbidden;

	public constructor() {
		super("Cannot impersonate another super administrator");
	}
}

/** The target belongs to a tenant for which the administrator has no approved support grant. */
export class ImpersonationGrantRequiredError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.forbidden;

	public constructor() {
		super("Impersonating a tenant member requires an approved support grant for each of their tenants");
	}
}

/** D36: the administrator already has a live impersonation session; stop it before starting another. */
export class ImpersonationAlreadyActiveError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.impersonationAlreadyActive;

	public constructor() {
		super("An impersonation session is already active for this administrator; stop it before starting another");
	}
}

/** The request is itself an impersonation session. */
export class AlreadyImpersonatingError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.alreadyImpersonating;

	public constructor() {
		super("Already impersonating; stop the current session first");
	}
}

/** Impersonation needs an MFA proof younger than the step-up window. */
export class MfaStepUpRequiredError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.mfaStepUpRequired;

	public constructor() {
		super("Fresh MFA verification required before impersonation.");
	}
}

export class ImpersonatorAccountNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.notFound;

	public constructor() {
		super("Original administrator account not found");
	}
}

export class ImpersonatorNotEligibleError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.impersonatorNotEligible;

	public constructor() {
		super("The original administrator account can no longer be restored");
	}
}

/** The impersonation session is unknown, of another pair, expired or already ended. */
export class ImpersonationSessionInvalidError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.impersonationSessionInvalid;

	public constructor() {
		super("Impersonation session has ended or is no longer valid");
	}
}

// ── Own profile ─────────────────────────────────────────────────────────────

export class ProfileUpdateDuringImpersonationError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.profileUpdateDuringImpersonation;

	public constructor() {
		super(PROFILE_UPDATE_DURING_IMPERSONATION_MESSAGE);
	}
}

/** The signed-in user's own profile is gone (the account was soft-deleted). */
export class ProfileNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.notFound;

	public constructor(userId: string) {
		// The id is the caller's own, so echoing it back is safe (same envelope as `ResourceNotFoundError`).
		super("The requested resource was not found.", { resourceId: userId });
	}
}

// ── SuperAdmin bootstrap (CLI) ──────────────────────────────────────────────

/** An active, non-deleted SuperAdmin already exists: the bootstrap is one-time and refuses. */
export class SuperAdminAlreadyExistsError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.superAdminAlreadyExists;

	public constructor() {
		super("An active SuperAdmin already exists, so this one-time command refuses to run. Manage SuperAdmins from the admin panel (Roles) instead.");
	}
}

/** The email already belongs to an account — the bootstrap creates an account, it never promotes one. */
export class BootstrapEmailTakenError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.bootstrapEmailTaken;

	public constructor() {
		super("An account with that email already exists. The bootstrap creates a new account and never promotes an existing one; use a different email.");
	}
}

/** The platform role catalog is not loaded, so the SuperAdmin role cannot be assigned. */
export class SuperAdminRoleMissingError extends DomainError {
	public readonly code: DomainErrorCode = IDENTITY_ERROR_CODES.superAdminRoleMissing;

	public constructor(roleName: string) {
		super(
			`The platform role "${roleName}" does not exist. Load the reference data first with "pnpm --filter @workspace/api db:sync-reference-data" (idempotent, creates no users or demo data), then re-run.`,
		);
	}
}

// ── Integrity ───────────────────────────────────────────────────────────────
