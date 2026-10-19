import type { LoginVerificationMode } from "../services/pending-sign-in";

/** The configuration values identity's rules read (validated at boot). */
export interface IdentitySettings {
	/** Grace before MFA enrollment becomes mandatory for a new account; `<= 0` means immediately. */
	readonly mfaEnrollmentGraceMs: number;
	/** Delay between an approved MFA recovery and the factor being cleared. */
	readonly mfaRecoveryDelayMs: number;
	/** How fresh an MFA proof must be to start impersonation. */
	readonly mfaStepUpTtlMs: number;
	readonly loginVerificationMode: LoginVerificationMode;
	/** Lifetime of a device session (the refresh-token expiry). */
	readonly sessionLifetimeMs: number;
	/** `issuer` of TOTP key URIs. */
	readonly twoFactorIssuer: string;
}
