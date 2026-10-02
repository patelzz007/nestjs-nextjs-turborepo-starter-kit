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
		return [
			this.paragraph(`Two-factor authentication was turned ${this.strong("off")} for your ${this.strong(context.appName)} account. Signing in now needs only your password.`),
			this.callout("Wasn't you?", "Reset your password and contact support immediately, then turn two-factor authentication back on."),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`Two-factor authentication was disabled on your ${context.appName} account.`,
			"",
			"If you did not make this change, reset your password and contact support immediately.",
		].join("\n");
	}
}
