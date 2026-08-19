import {
	PasswordResetEmailPropsSchema,
	type PasswordResetEmailProps,
} from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/**
 * Sent when a user requests a password reset. The link contains a raw,
 * single-use token — the API hashes it before storing.
 */
export class PasswordResetEmailTemplate extends BaseEmailTemplate<PasswordResetEmailProps> {
	/** Sample props used by the admin preview + screenshot pipeline. */
	public static readonly sampleProps: PasswordResetEmailProps = {
		to: "jamie@example.com",
		resetToken: "demo-reset-token-2026",
		expiresInHours: 1,
	};

	public readonly key: string = "password-reset";
	public readonly propsSchema = PasswordResetEmailPropsSchema;
	public readonly subject: string = "Reset your password";
	protected readonly accent: EmailAccent = "indigo";
	protected readonly eyebrow: string = "Password Reset";
	protected readonly heading: string = "Let's get you back in";

	public getPreviewText(context: EmailRenderContext): string {
		return `We received a request to reset your ${context.appName} password.`;
	}

	public getCta(context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Reset Password",
			href: this.buildUrl(context, "/auth/reset-password", { token: this.props.resetToken }),
		};
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		const href: string = this.buildUrl(context, "/auth/reset-password", { token: this.props.resetToken });
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">We received a request to reset your <strong>${this.escape(context.appName)}</strong> password. Click the button below to create a new one.</p>
        ${this.linkBlock(href)}
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 6px 0;">This link expires in <strong>${String(this.props.expiresInHours)} hour${this.props.expiresInHours === 1 ? "" : "s"}</strong>.</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">If you didn't request a password reset, you can safely ignore this email.</p>`;
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`We received a request to reset your ${context.appName} password.`,
			"",
			"Open the link below to create a new password:",
			`${context.appUrl}/auth/reset-password?token=${this.props.resetToken}`,
			"",
			`This link expires in ${String(this.props.expiresInHours)} hour${this.props.expiresInHours === 1 ? "" : "s"}.`,
			"If you didn't request a password reset, you can safely ignore this email.",
		].join("\n");
	}
}
