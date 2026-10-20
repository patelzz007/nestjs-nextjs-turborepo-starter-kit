import { APP_LINKS, EMAIL_VERIFICATION_LINK_TTL_HOURS, PASSWORD_RESET_LINK_TTL_HOURS, nowEpochMs, type EmailSendResult, type EpochMs } from "@workspace/shared";

import type { TypedConfigService } from "../../../../config/typed-config.service";
import {
	AccountLockedEmailTemplate,
	AdminAlertEmailTemplate,
	LoginVerificationEmailTemplate,
	PasswordChangedEmailTemplate,
	PasswordResetEmailTemplate,
	TwoFactorDisabledEmailTemplate,
	TwoFactorEnabledEmailTemplate,
	VerificationEmailTemplate,
	type EmailRequestTransactionalPort,
} from "../../../notifications/public-api";
import type { IdentityEmailPort } from "../../application/ports/identity-email.port";
import { LOGIN_VERIFICATION_TTL_MINUTES } from "../../application/services/login-verification.gate";

/**
 * Identity's emails over notifications' TRANSACTIONAL email request (ADR 060): the `pending` email log
 * and the outbox row commit or roll back with identity's business write (D25). Built per unit of work
 * by the scope factory, bound to that transaction. The transactional request port is created on the
 * first email only, so a unit of work that sends none (most of them) builds no email machinery.
 */
export class IdentityEmailAdapter implements IdentityEmailPort {
	private boundRequests: EmailRequestTransactionalPort | null = null;

	public constructor(
		private readonly createRequests: () => EmailRequestTransactionalPort,
		private readonly config: TypedConfigService,
	) {}

	private get requests(): EmailRequestTransactionalPort {
		this.boundRequests ??= this.createRequests();
		return this.boundRequests;
	}

	public async sendVerificationEmail(email: string, verificationToken: string, clientType: string | undefined): Promise<void> {
		const appUrl: string = this.config.resolveClientAppUrl(clientType);
		await this.requests.request(new VerificationEmailTemplate({ to: email, verificationToken, expiresInHours: EMAIL_VERIFICATION_LINK_TTL_HOURS, appUrl }));
	}

	public async sendPasswordResetEmail(email: string, resetToken: string, clientType: string | undefined): Promise<void> {
		const appUrl: string = this.config.resolveClientAppUrl(clientType);
		await this.requests.request(new PasswordResetEmailTemplate({ to: email, resetToken, expiresInHours: PASSWORD_RESET_LINK_TTL_HOURS, appUrl }));
	}

	public async sendAccountLockedEmail(email: string, lockedUntil: EpochMs): Promise<void> {
		await this.requests.request(new AccountLockedEmailTemplate({ to: email, lockedUntil }));
	}

	public async sendPasswordChangedEmail(email: string): Promise<void> {
		await this.requests.request(new PasswordChangedEmailTemplate({ to: email, changedAt: nowEpochMs() }));
	}

	public async sendTwoFactorEnabledEmail(email: string): Promise<void> {
		await this.requests.request(new TwoFactorEnabledEmailTemplate({ to: email, changedAt: nowEpochMs() }));
	}

	public async sendTwoFactorDisabledEmail(email: string): Promise<void> {
		await this.requests.request(new TwoFactorDisabledEmailTemplate({ to: email, changedAt: nowEpochMs() }));
	}

	public async sendLoginVerificationEmail(email: string, verificationCode: string, deviceInfo: string, ipAddress: string): Promise<EmailSendResult> {
		return this.requests.request(new LoginVerificationEmailTemplate({ to: email, verificationCode, expiresInMinutes: LOGIN_VERIFICATION_TTL_MINUTES, deviceInfo, ipAddress }));
	}

	/** Informational — no button: the recipient may belong to any app. */
	public async sendMfaRecoveryUserNotification(email: string, title: string, message: string): Promise<void> {
		await this.requests.request(new AdminAlertEmailTemplate({ to: email, title, message }));
	}

	/** Links straight to the PENDING requests — the ones awaiting this reviewer. */
	public async sendMfaRecoveryAdminNotification(email: string, title: string, message: string): Promise<void> {
		const queueUrl: string = new URL(APP_LINKS.admin.mfaRecoveryPendingQueue, this.config.clientApps.adminUrl).toString();
		await this.requests.request(new AdminAlertEmailTemplate({ to: email, title, message, action: { label: "Review recovery requests", url: queueUrl } }));
	}
}
