import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { DefaultRoleAssignmentPort } from "../../authorization/public-api";
import type { TransactionalSignupReferralPort } from "../../referrals/public-api";
import type { DeviceSessionRepository } from "../domain/repositories/device-session.repository";
import type { ImpersonationSessionRepository } from "../domain/repositories/impersonation-session.repository";
import type { MfaRecoveryRequestRepository } from "../domain/repositories/mfa-recovery-request.repository";
import type { PasswordResetTokenRepository } from "../domain/repositories/password-reset-token.repository";
import type { TwoFactorEnrollmentRepository, TwoFactorLoginChallengeRepository } from "../domain/repositories/two-factor.repository";
import type { UserAccountRepository } from "../domain/repositories/user-account.repository";
import type { UserPreferenceRepository } from "../domain/repositories/user-preference.repository";
import type { UserProfileRepository } from "../domain/repositories/user-profile.repository";
import type { IdentityEmailPort } from "./ports/identity-email.port";
import type { RequestAuditPort } from "./ports/request-audit.port";

/** Everything one identity transaction can touch. Every member is bound to that transaction. */
export interface IdentityScope {
	readonly accounts: UserAccountRepository;
	readonly resetTokens: PasswordResetTokenRepository;
	readonly twoFactor: TwoFactorEnrollmentRepository;
	readonly challenges: TwoFactorLoginChallengeRepository;
	readonly mfaRecoveries: MfaRecoveryRequestRepository;
	readonly sessions: DeviceSessionRepository;
	readonly impersonations: ImpersonationSessionRepository;
	readonly profiles: UserProfileRepository;
	readonly preferences: UserPreferenceRepository;
	readonly signupReferrals: TransactionalSignupReferralPort;
	readonly roles: DefaultRoleAssignmentPort;
	readonly emails: IdentityEmailPort;
	readonly requestAudit: RequestAuditPort;
	readonly events: TransactionalEventCollector;
}
