import { WelcomeEmailPropsSchema, type WelcomeEmailProps, APP_LINKS } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/**
 * Sent once after the first successful email verification. Onboarding email —
 * product-level copy, CTA to the app home.
 */
export class WelcomeEmailTemplate extends BaseEmailTemplate<WelcomeEmailProps> {
	/** Sample props used by the admin preview + screenshot pipeline. */
	public static readonly sampleProps: WelcomeEmailProps = {
		to: "jamie@example.com",
		fullName: "Jamie",
	};

	public readonly key: string = "welcome";
	public readonly propsSchema = WelcomeEmailPropsSchema;
	public readonly subject: string = "Welcome aboard!";
	protected readonly accent: EmailAccent = "green";
	protected readonly eyebrow: string = "Getting started";
	protected readonly heading: string = "You're in!";

	public getPreviewText(context: EmailRenderContext): string {
		return `Your ${context.appName} account is verified — here's how to claim your first reward.`;
	}

	/** The button sits in the body, between the steps and the help note. */
	protected override readonly ctaPlacement = "in-body";

	public override getCta(context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Browse offers",
			href: this.buildUrl(context, APP_LINKS.web.home),
		};
	}

	// renderBodyHtml / renderBodyText intentionally ignore the context (no
	// URLs needed in this template) — the abstract contract requires the
	// param, so it's prefixed with an underscore.
	public renderBodyHtml(context: EmailRenderContext): string {
		return [
			this.paragraph(`Hi ${this.strong(this.props.fullName)}, your email is verified and your ${this.strong(context.appName)} account is ready.`),
			this.paragraph("Here's how it works:"),
			this.steps([
				{ title: "Browse offers", description: "Free items and discounts from cafés, restaurants and shops near you." },
				{ title: "Claim in a tap", description: "Verify with a one-time code and the reward lands in your wallet." },
				{ title: "Redeem in store", description: "Show the QR code at the counter before it expires." },
			]),
			this.ctaInBody(context),
			this.note("Need help? Just reply to this email — a real person reads it."),
		].join("");
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return [
			`Hi ${this.props.fullName}, your email is verified and your account is ready.`,
			"",
			"Here's how it works:",
			"1. Browse offers — free items and discounts from cafés, restaurants and shops near you.",
			"2. Claim in a tap — verify with a one-time code and the reward lands in your wallet.",
			"3. Redeem in store — show the QR code at the counter before it expires.",
			"",
			"Need help? Just reply to this email — a real person reads it.",
		].join("\n");
	}
}
