import { PasswordResetEmailPropsSchema, type PasswordResetEmailProps, APP_LINKS } from "@workspace/shared";

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

	private linkContext(context: EmailRenderContext): EmailRenderContext {
		if (this.props.appUrl === undefined) {
			return context;
		}
		return { ...context, appUrl: this.props.appUrl };
	}

	/** The button sits in the body, above the copy-link fallback. */
	protected override readonly ctaPlacement = "in-body";

	public override getCta(context: EmailRenderContext): CtaConfig | null {
		const linkContext: EmailRenderContext = this.linkContext(context);
		return {
			label: "Reset password",
			href: this.buildUrl(linkContext, APP_LINKS.auth.resetPassword, { token: this.props.resetToken }),
		};
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		const linkContext: EmailRenderContext = this.linkContext(context);
		const href: string = this.buildUrl(linkContext, APP_LINKS.auth.resetPassword, { token: this.props.resetToken });
		const hours = `${String(this.props.expiresInHours)} hour${this.props.expiresInHours === 1 ? "" : "s"}`;
		return [
			this.paragraph(`We received a request to reset your ${this.strong(context.appName)} password. Choose a new one with the button below.`),
			this.ctaInBody(context),
			this.linkBlock(href),
			this.note(`This link expires in ${this.strong(hours)}. Didn't ask for a reset? Ignore this email — your password stays the same.`),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		const linkContext: EmailRenderContext = this.linkContext(context);
		const href: string = this.buildUrl(linkContext, APP_LINKS.auth.resetPassword, { token: this.props.resetToken });
		return [
			`We received a request to reset your ${context.appName} password.`,
			"",
			"Open the link below to create a new password:",
			href,
			"",
			`This link expires in ${String(this.props.expiresInHours)} hour${this.props.expiresInHours === 1 ? "" : "s"}.`,
			"If you didn't request a password reset, you can safely ignore this email.",
		].join("\n");
	}
}
