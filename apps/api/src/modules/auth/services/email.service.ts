import { Injectable } from "@nestjs/common";

import type { EpochMs, EmailSendResult } from "@workspace/shared";
import { epochMs, APP_LINKS, EMAIL_VERIFICATION_LINK_TTL_HOURS, PASSWORD_RESET_LINK_TTL_HOURS } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { AccountLockedEmailTemplate } from "../../notifications/email/templates/account-locked-email.template";
import { AdminAlertEmailTemplate } from "../../notifications/email/templates/admin-alert-email.template";
import { LoginVerificationEmailTemplate } from "../../notifications/email/templates/login-verification-email.template";
import { PasswordChangedEmailTemplate } from "../../notifications/email/templates/password-changed-email.template";
import { PasswordResetEmailTemplate } from "../../notifications/email/templates/password-reset-email.template";
import { TwoFactorDisabledEmailTemplate } from "../../notifications/email/templates/two-factor-disabled-email.template";
import { TwoFactorEnabledEmailTemplate } from "../../notifications/email/templates/two-factor-enabled-email.template";
import { VerificationEmailTemplate } from "../../notifications/email/templates/verification-email.template";

/**
 * Legacy facade kept so `auth.service.ts` call sites stay unchanged.
 *
 * Every method now delegates to the shared `EmailSenderService` + the
 * `BaseEmailTemplate` system — the ~250 lines of copy-pasted HTML that lived
 * here are gone. `send()` never throws, so the "never reveal whether an email
 * exists" guarantee from the old implementation is preserved by the sender.
 */
@Injectable()
export class EmailService {
	constructor(
		private readonly sender: EmailSenderService,
		private readonly config: TypedConfigService,
	) {}

	/** Send a password-reset email (single-use token in the link). */
	public async sendPasswordResetEmail(email: string, resetToken: string, clientType?: string): Promise<void> {
		const appUrl: string = this.config.resolveClientAppUrl(clientType);
		const template = new PasswordResetEmailTemplate({ to: email, resetToken, expiresInHours: PASSWORD_RESET_LINK_TTL_HOURS, appUrl });
		await this.sender.send(template);
	}

	/** Send an email-verification email (one-time token in the link). */
	public async sendVerificationEmail(email: string, verificationToken: string, clientType?: string): Promise<void> {
		const appUrl: string = this.config.resolveClientAppUrl(clientType);
		const template = new VerificationEmailTemplate({ to: email, verificationToken, expiresInHours: EMAIL_VERIFICATION_LINK_TTL_HOURS, appUrl });
		await this.sender.send(template);
	}

	/** Send an account-locked notice with the remaining lock duration. */
	public async sendAccountLockedEmail(email: string, lockedUntil: EpochMs): Promise<void> {
		const template = new AccountLockedEmailTemplate({ to: email, lockedUntil });
		await this.sender.send(template);
	}

	public async sendPasswordChangedEmail(email: string): Promise<void> {
		const template = new PasswordChangedEmailTemplate({ to: email, changedAt: epochMs(Date.now()) });
		await this.sender.send(template);
	}

	public async sendTwoFactorEnabledEmail(email: string): Promise<void> {
		const template = new TwoFactorEnabledEmailTemplate({ to: email, changedAt: epochMs(Date.now()) });
		await this.sender.send(template);
	}

	public async sendTwoFactorDisabledEmail(email: string): Promise<void> {
		const template = new TwoFactorDisabledEmailTemplate({ to: email, changedAt: epochMs(Date.now()) });
		await this.sender.send(template);
	}

	public async sendLoginVerificationEmail(email: string, verificationCode: string, deviceInfo: string, ipAddress: string): Promise<EmailSendResult> {
		const template = new LoginVerificationEmailTemplate({
			to: email,
			verificationCode,
			expiresInMinutes: 10,
			deviceInfo,
			ipAddress,
		});
		return this.sender.send(template);
	}

	/** Informational — no button: the recipient may belong to any app, so there is no single place to send them. */
	public async sendMfaRecoveryUserNotification(email: string, title: string, message: string): Promise<void> {
		const template = new AdminAlertEmailTemplate({ to: email, title, message });
		await this.sender.send(template);
	}

	/** Links straight to the PENDING requests — the ones awaiting this reviewer. */
	public async sendMfaRecoveryAdminNotification(email: string, title: string, message: string): Promise<void> {
		const queueUrl: string = new URL(APP_LINKS.admin.mfaRecoveryPendingQueue, this.config.clientApps.adminUrl).toString();
		const template = new AdminAlertEmailTemplate({ to: email, title, message, action: { label: "Review recovery requests", url: queueUrl } });
		await this.sender.send(template);
	}
}
