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
		return [
			this.paragraph(`Two-factor authentication is now ${this.strong("on")} for your ${this.strong(context.appName)} account.`),
			this.highlight("Your account is better protected", "Next time you sign in, we'll ask for a code from your authenticator app."),
			this.note("Keep your backup codes somewhere safe — they get you in if you lose your phone."),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`Two-factor authentication is now enabled on your ${context.appName} account.`,
			"",
			"You'll be asked for a code from your authenticator app the next time you sign in.",
		].join("\n");
	}
}
