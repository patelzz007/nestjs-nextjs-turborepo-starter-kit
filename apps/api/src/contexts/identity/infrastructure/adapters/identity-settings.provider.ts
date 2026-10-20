import { parseExpiryToMilliseconds } from "../../../../platform/infrastructure/utils/expiry";
import type { TypedConfigService } from "../../../../config/typed-config.service";
import type { IdentitySettings } from "../../application/ports/identity-settings.port";

/** The identity rules' configuration, read once from the validated config. */
export function identitySettingsFrom(config: TypedConfigService): IdentitySettings {
	return {
		mfaEnrollmentGraceMs: config.mfa.enrollmentDeadlineMs,
		mfaRecoveryDelayMs: config.mfa.recoveryDelayMs,
		mfaStepUpTtlMs: config.mfa.stepUpTtlMs,
		loginVerificationMode: config.auth.loginVerificationMode,
		sessionLifetimeMs: parseExpiryToMilliseconds(config.auth.jwtRefreshExpiry),
		twoFactorIssuer: config.auth.twoFactorIssuer,
	};
}
