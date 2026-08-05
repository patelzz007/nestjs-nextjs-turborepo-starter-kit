import { Injectable } from "@nestjs/common";
import { Resend } from "resend";

import { TypedConfigService } from "../../../config/typed-config.service.js";
import { LogService } from "../../../modules/logs/logs.service.js";

@Injectable()
export class EmailService {
	private readonly resend: Resend;
	private readonly fromAddress: string;
	private readonly appName: string;
	private readonly appUrl: string;

	constructor(
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
	) {
		this.resend = new Resend(this.config.resendApiKey);
		this.fromAddress = this.config.emailFromAddress;
		this.appName = this.config.appName;
		this.appUrl = this.config.appUrl;
	}

	/**
	 * Send a password reset email to the given address.
	 * Contains a reset link with the token as a URL parameter.
	 */
	public async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
		const resetUrl = `${this.appUrl}/auth/reset-password?token=${resetToken}`;
		const year = new Date().getFullYear();

		try {
			await this.resend.emails.send({
				from: this.fromAddress,
				to: email,
				subject: `Reset your ${this.appName} password`,
				html: this.buildPasswordResetHtml(resetUrl, year),
				text: this.buildPasswordResetText(resetUrl, year),
			});

			this.logService.info("Password reset email sent", { context: "EmailService", metadata: { to: email } });
		} catch {
			this.logService.error("Failed to send password reset email", { context: "EmailService", metadata: { to: email } });
			// Never throw — don't reveal whether the email exists
		}
	}

	/**
	 * Send an email verification email to the given address.
	 * Contains a verification link with the token as a URL parameter.
	 */
	public async sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
		const verifyUrl = `${this.appUrl}/auth/verify-email/${verificationToken}`;
		const year = new Date().getFullYear();

		try {
			await this.resend.emails.send({
				from: this.fromAddress,
				to: email,
				subject: `Verify your ${this.appName} email address`,
				html: this.buildVerificationHtml(verifyUrl, year),
				text: this.buildVerificationText(verifyUrl, year),
			});

			this.logService.info("Verification email sent", { context: "EmailService", metadata: { to: email } });
		} catch {
			this.logService.error("Failed to send verification email", { context: "EmailService", metadata: { to: email } });
			// Never throw — don't reveal whether the email exists
		}
	}

	/**
	 * Send an account-locked notification to the given address.
	 * Informs the user that their account has been temporarily locked due to
	 * too many failed login attempts.
	 */
	public async sendAccountLockedEmail(email: string, lockedUntil: Date): Promise<void> {
		const remainingMs: number = lockedUntil.getTime() - Date.now();
		const remainingMin: number = Math.max(1, Math.ceil(remainingMs / 60_000));
		const year: number = new Date().getFullYear();

		try {
			await this.resend.emails.send({
				from: this.fromAddress,
				to: email,
				subject: `Your ${this.appName} account has been temporarily locked`,
				html: this.buildAccountLockedHtml(remainingMin, year),
				text: this.buildAccountLockedText(remainingMin, year),
			});

			this.logService.info("Account locked email sent", { context: "EmailService", metadata: { to: email } });
		} catch {
			this.logService.error("Failed to send account locked email", { context: "EmailService", metadata: { to: email } });
			// Never throw — the lock has already been applied
		}
	}

	// ── Template builders ──────────────────────────────────────────────

	private buildVerificationHtml(verifyUrl: string, year: number): string {
		return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto;">
    <tr>
      <td style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${this.appName}</h1>
        <p style="color: #bbf7d0; margin: 8px 0 0 0; font-size: 14px;">Email Verification</p>
      </td>
    </tr>
    <tr>
      <td style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">Thanks for joining <strong>${this.appName}</strong>! Please verify your email address by clicking the button below.</p>

        <table cellpadding="0" cellspacing="0" style="margin: 24px auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 8px; padding: 0;">
              <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Verify Email</a>
            </td>
          </tr>
        </table>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">Or copy and paste this link into your browser:</p>
        <p style="background: #f4f4f5; padding: 12px; border-radius: 6px; font-size: 13px; color: #374151; word-break: break-all; margin: 0 0 16px 0;">${verifyUrl}</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">This link will expire in 24 hours.</p>
        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">If you did not create an account, you can safely ignore this email.</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 0; text-align: center;">			<p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${String(year)} ${this.appName}. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
	}

	private buildVerificationText(verifyUrl: string, year: number): string {
		return [
			`${this.appName} — Email Verification`,
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━",
			"",
			`Thanks for joining ${this.appName}!`,
			"",
			`Click this link to verify your email address: ${verifyUrl}`,
			"",
			"This link will expire in 24 hours.",
			"",
			"If you did not create an account, you can safely ignore this email.",
			"",
			`© ${String(year)} ${this.appName}. All rights reserved.`,
		].join("\n");
	}

	private buildPasswordResetHtml(resetUrl: string, year: number): string {
		return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto;">
    <tr>
      <td style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${this.appName}</h1>
        <p style="color: #c7d2fe; margin: 8px 0 0 0; font-size: 14px;">Password Reset</p>
      </td>
    </tr>
    <tr>
      <td style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">We received a request to reset your <strong>${this.appName}</strong> password. Click the button below to create a new password.</p>

        <table cellpadding="0" cellspacing="0" style="margin: 24px auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; padding: 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Reset Password</a>
            </td>
          </tr>
        </table>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">Or copy and paste this link into your browser:</p>
        <p style="background: #f4f4f5; padding: 12px; border-radius: 6px; font-size: 13px; color: #374151; word-break: break-all; margin: 0 0 16px 0;">${resetUrl}</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">This link will expire in 1 hour.</p>
        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">If you did not request a password reset, you can safely ignore this email.</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 0; text-align: center;">			<p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${String(year)} ${this.appName}. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
	}

	private buildPasswordResetText(resetUrl: string, year: number): string {
		return [
			`${this.appName} — Password Reset Request`,
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━",
			"",
			`We received a request to reset your ${this.appName} password.`,
			"",
			`Click this link to reset your password: ${resetUrl}`,
			"",
			"This link will expire in 1 hour.",
			"",
			"If you did not request a password reset, you can safely ignore this email.",
			"",
			`© ${String(year)} ${this.appName}. All rights reserved.`,
		].join("\n");
	}

	private buildAccountLockedHtml(remainingMin: number, year: number): string {
		return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto;">
    <tr>
      <td style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${this.appName}</h1>
        <p style="color: #fca5a5; margin: 8px 0 0 0; font-size: 14px;">Account Temporarily Locked</p>
      </td>
    </tr>
    <tr>
      <td style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">
          Your <strong>${this.appName}</strong> account has been <strong style="color: #dc2626;">temporarily locked</strong>
          due to too many failed login attempts.
        </p>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="color: #991b1b; font-size: 18px; font-weight: 600; margin: 0 0 8px 0; text-align: center;">
            Locked for ${String(remainingMin)} minute${remainingMin === 1 ? "" : "s"}
          </p>
          <p style="color: #7f1d1d; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
            You will be able to try again after this period ends.
          </p>
        </div>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
          If you forgot your password, you can request a password reset on the login page.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
          If you did not attempt to log in, someone else may be trying to access your account.
          Please contact support if you have any concerns.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 0; text-align: center;">			<p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${String(year)} ${this.appName}. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
	}

	private buildAccountLockedText(remainingMin: number, year: number): string {
		return [
			`${this.appName} — Account Temporarily Locked`,
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━",
			"",
			"Your account has been temporarily locked due to too many failed login attempts.",
			"",
			`Locked for ${String(remainingMin)} minute${remainingMin === 1 ? "" : "s"}.`,
			"You will be able to try again after this period ends.",
			"",
			"If you forgot your password, you can request a password reset on the login page.",
			"",
			"If you did not attempt to log in, someone else may be trying to access your account.",
			"Please contact support if you have any concerns.",
			"",
			`© ${String(year)} ${this.appName}. All rights reserved.`,
		].join("\n");
	}
}
