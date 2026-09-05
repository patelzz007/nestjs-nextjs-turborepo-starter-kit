import { TwoFactorStatusEmailPropsSchema, epochMs, type EmailAccent, type TwoFactorStatusEmailProps } from "@workspace/shared";

import { BaseEmailTemplate } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

export class TwoFactorDisabledEmailTemplate extends BaseEmailTemplate<TwoFactorStatusEmailProps> {
	public static readonly sampleProps: TwoFactorStatusEmailProps = {
		to: "jamie@example.com",
		changedAt: epochMs(Date.now()),
	};

	public readonly key: string = "two-factor-disabled";
	public readonly propsSchema = TwoFactorStatusEmailPropsSchema;
	public readonly subject: string = "Two-factor authentication disabled";
	protected readonly accent: EmailAccent = "amber";
	protected readonly eyebrow: string = "Security Notice";
	protected readonly heading: string = "2FA was turned off";

	public getPreviewText(context: EmailRenderContext): string {
		return `Two-factor authentication was disabled on your ${context.appName} account.`;
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">Two-factor authentication was disabled on your <strong>${this.escape(context.appName)}</strong> account.</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">If you did not make this change, reset your password and contact support immediately.</p>`;
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`Two-factor authentication was disabled on your ${context.appName} account.`,
			"",
			"If you did not make this change, reset your password and contact support immediately.",
		].join("\n");
	}
}
