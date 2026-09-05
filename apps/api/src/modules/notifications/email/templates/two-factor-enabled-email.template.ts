import { TwoFactorStatusEmailPropsSchema, epochMs, type EmailAccent, type TwoFactorStatusEmailProps } from "@workspace/shared";

import { BaseEmailTemplate } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

export class TwoFactorEnabledEmailTemplate extends BaseEmailTemplate<TwoFactorStatusEmailProps> {
	public static readonly sampleProps: TwoFactorStatusEmailProps = {
		to: "jamie@example.com",
		changedAt: epochMs(Date.now()),
	};

	public readonly key: string = "two-factor-enabled";
	public readonly propsSchema = TwoFactorStatusEmailPropsSchema;
	public readonly subject: string = "Two-factor authentication enabled";
	protected readonly accent: EmailAccent = "green";
	protected readonly eyebrow: string = "Security";
	protected readonly heading: string = "2FA is now active";

	public getPreviewText(context: EmailRenderContext): string {
		return `Two-factor authentication was enabled on your ${context.appName} account.`;
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">Two-factor authentication is now enabled on your <strong>${this.escape(context.appName)}</strong> account.</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">You'll be asked for a code from your authenticator app the next time you sign in.</p>`;
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`Two-factor authentication is now enabled on your ${context.appName} account.`,
			"",
			"You'll be asked for a code from your authenticator app the next time you sign in.",
		].join("\n");
	}
}
