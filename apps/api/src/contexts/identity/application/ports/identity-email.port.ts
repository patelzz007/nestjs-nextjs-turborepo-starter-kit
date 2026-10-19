import type { EmailSendResult, EpochMs } from "@workspace/shared";

/**
 * The emails identity sends. Bound to the unit of work that makes the business write, so the
 * request commits with it through notifications' transactional email port (ADR 060).
 */
export interface IdentityEmailPort {
	sendVerificationEmail(email: string, verificationToken: string, clientType: string | undefined): Promise<void>;
	sendPasswordResetEmail(email: string, resetToken: string, clientType: string | undefined): Promise<void>;
	sendAccountLockedEmail(email: string, lockedUntil: EpochMs): Promise<void>;
	sendPasswordChangedEmail(email: string): Promise<void>;
	sendTwoFactorEnabledEmail(email: string): Promise<void>;
	sendTwoFactorDisabledEmail(email: string): Promise<void>;
	sendLoginVerificationEmail(email: string, verificationCode: string, deviceInfo: string, ipAddress: string): Promise<EmailSendResult>;
	sendMfaRecoveryUserNotification(email: string, title: string, message: string): Promise<void>;
	sendMfaRecoveryAdminNotification(email: string, title: string, message: string): Promise<void>;
}
