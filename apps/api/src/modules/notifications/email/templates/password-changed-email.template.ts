import { PasswordChangedEmailPropsSchema, epochMs, type EmailAccent, type PasswordChangedEmailProps } from "@workspace/shared";

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
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">Your <strong>${this.escape(context.appName)}</strong> password was changed successfully.</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">If you did not make this change, contact support immediately and reset your password.</p>`;
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [`Your ${context.appName} password was changed successfully.`, "", "If you did not make this change, contact support immediately and reset your password."].join(
			"\n",
		);
	}
}
