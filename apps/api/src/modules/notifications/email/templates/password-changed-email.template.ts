import { PasswordChangedEmailPropsSchema, epochMs, type EmailAccent, type PasswordChangedEmailProps, APP_LINKS } from "@workspace/shared";

import { BaseEmailTemplate } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

export class PasswordChangedEmailTemplate extends BaseEmailTemplate<PasswordChangedEmailProps> {
	public static readonly sampleProps: PasswordChangedEmailProps = {
		to: "jamie@example.com",
		changedAt: epochMs(Date.now()),
	};

	public readonly key: string = "password-changed";
	public readonly propsSchema = PasswordChangedEmailPropsSchema;
	public readonly subject: string = "Your password was changed";
	protected readonly accent: EmailAccent = "amber";
	protected readonly eyebrow: string = "Security Notice";
	protected readonly heading: string = "Password updated";

	public getPreviewText(context: EmailRenderContext): string {
		return `Your ${context.appName} password was changed successfully.`;
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return [
			this.paragraph(`The password for your ${this.strong(context.appName)} account was just changed.`),
			this.callout("Wasn't you?", "Reset your password right away and contact support — someone else may have access to your account."),
			this.note(`Reset it here: ${this.link(this.buildUrl(context, APP_LINKS.auth.forgotPassword), "forgot password")}.`),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [`Your ${context.appName} password was changed successfully.`, "", "If you did not make this change, contact support immediately and reset your password."].join(
			"\n",
		);
	}
}
