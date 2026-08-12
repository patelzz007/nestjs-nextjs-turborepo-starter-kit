import { z } from "zod";

import { BaseEmailPropsSchema, BaseEmailTemplate, type CtaConfig } from "../base/base-email-template.js";
import type { EmailRenderContext } from "../base/email-render-context.js";

export const VerificationEmailPropsSchema = BaseEmailPropsSchema.extend({
	/** One-time verification token embedded in the link. */
	verificationToken: z.string().min(1),
	/** Link lifetime shown to the user (default 24h). */
	expiresInHours: z.number().int().positive().default(24),
});

export type VerificationEmailProps = z.output<typeof VerificationEmailPropsSchema>;

/**
 * Sent after signup — proves the user owns the inbox before they can use
 * email-dependent flows.
 */
export class VerificationEmailTemplate extends BaseEmailTemplate<VerificationEmailProps> {
	/** Sample props used by the admin preview + screenshot pipeline. */
	public static readonly sampleProps: VerificationEmailProps = {
		to: "jamie@example.com",
		verificationToken: "demo-verify-token-2026",
		expiresInHours: 24,
	};

	public readonly key: string = "verification";
	public readonly propsSchema = VerificationEmailPropsSchema;
	public readonly subject: string = "Verify your email address";
	protected readonly accent = "green" as const;
	protected readonly eyebrow: string = "Email Verification";
	protected readonly heading: string = "Thanks for joining!";

	public getPreviewText(context: EmailRenderContext): string {
		return `Confirm your ${context.appName} email and you're all set.`;
	}

	public getCta(context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Verify Email",
			href: this.buildUrl(context, `/auth/verify-email/${this.props.verificationToken}`),
		};
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		const href: string = this.buildUrl(context, `/auth/verify-email/${this.props.verificationToken}`);
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 8px 0;">Welcome to <strong>${this.escape(context.appName)}</strong>! Please confirm your email address so we know it's really you.</p>
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">One click and your account is ready to go.</p>
        ${this.linkBlock(href)}
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 6px 0;">This link expires in <strong>${String(this.props.expiresInHours)} hours</strong>.</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">If you didn't create an account, you can safely ignore this email.</p>`;
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`Welcome to ${context.appName}!`,
			"",
			"Please confirm your email address by opening the link below:",
			`${context.appUrl}/auth/verify-email/${this.props.verificationToken}`,
			"",
			`This link expires in ${String(this.props.expiresInHours)} hours.`,
			"If you didn't create an account, you can safely ignore this email.",
		].join("\n");
	}
}
