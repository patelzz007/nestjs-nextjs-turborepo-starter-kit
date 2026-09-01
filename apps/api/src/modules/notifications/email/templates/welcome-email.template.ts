import { WelcomeEmailPropsSchema, type WelcomeEmailProps } from "@workspace/shared";

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
	protected readonly eyebrow: string = "Getting Started";
	protected readonly heading: string = "You're in!";

	public getPreviewText(context: EmailRenderContext): string {
		return `Your ${context.appName} account is verified — here's how to make the most of it.`;
	}

	public getCta(context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Open Dashboard",
			href: this.buildUrl(context, "/"),
		};
	}

	// renderBodyHtml / renderBodyText intentionally ignore the context (no
	// URLs needed in this template) — the abstract contract requires the
	// param, so it's prefixed with an underscore.
	public renderBodyHtml(_context: EmailRenderContext): string {
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Hi <strong>${this.escape(this.props.fullName)}</strong>, your email is verified and your account is ready.</p>
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 8px 0;">Three things to try first:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px 0;">
          <tr>
            <td class="email-text" style="color: #334155; font-size: 14px; line-height: 1.7; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <strong>1.</strong> Create your first short link<br>
              <strong>2.</strong> Share it anywhere — analytics track every click<br>
              <strong>3.</strong> Invite your team and set permissions
            </td>
          </tr>
        </table>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">Need help? Just reply to this email — a human reads it.</p>`;
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return [
			`Hi ${this.props.fullName}, your email is verified and your account is ready.`,
			"",
			"Three things to try first:",
			"1. Create your first short link",
			"2. Share it anywhere — analytics track every click",
			"3. Invite your team and set permissions",
			"",
			"Need help? Just reply to this email — a human reads it.",
		].join("\n");
	}
}
