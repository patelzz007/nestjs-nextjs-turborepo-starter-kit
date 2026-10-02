import { VerificationEmailPropsSchema, type VerificationEmailProps, APP_LINKS } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

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
	protected readonly accent: EmailAccent = "green";
	protected readonly eyebrow: string = "Email Verification";
	protected readonly heading: string = "Thanks for joining!";

	public getPreviewText(context: EmailRenderContext): string {
		return `Confirm your ${context.appName} email and you're all set.`;
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
			label: "Verify email",
			href: this.buildUrl(linkContext, APP_LINKS.auth.verifyEmail, { token: this.props.verificationToken }),
		};
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		const linkContext: EmailRenderContext = this.linkContext(context);
		const href: string = this.buildUrl(linkContext, APP_LINKS.auth.verifyEmail, { token: this.props.verificationToken });
		return [
			this.paragraph(`Welcome to ${this.strong(context.appName)}! Confirm your email address so we know it's really you — one click and your account is ready.`),
			this.ctaInBody(context),
			this.linkBlock(href),
			this.note(`This link expires in ${this.strong(`${String(this.props.expiresInHours)} hours`)}. Didn't create an account? You can safely ignore this email.`),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		const linkContext: EmailRenderContext = this.linkContext(context);
		const href: string = this.buildUrl(linkContext, APP_LINKS.auth.verifyEmail, { token: this.props.verificationToken });
		return [
			`Welcome to ${context.appName}!`,
			"",
			"Please confirm your email address by opening the link below:",
			href,
			"",
			`This link expires in ${String(this.props.expiresInHours)} hours.`,
			"If you didn't create an account, you can safely ignore this email.",
		].join("\n");
	}
}
