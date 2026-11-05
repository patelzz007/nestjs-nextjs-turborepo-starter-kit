import { PasskeyChangedEmailPropsSchema, epochMs, type EmailAccent, type PasskeyChangedEmailProps } from "@workspace/shared";

import { BaseEmailTemplate } from "./base/base-email-template";
import type { EmailRenderContext } from "./base/email-render-context";

/** Sent when a passkey is removed from an account (ADR 080). */
export class PasskeyRemovedEmailTemplate extends BaseEmailTemplate<PasskeyChangedEmailProps> {
	public static readonly sampleProps: PasskeyChangedEmailProps = {
		to: "jamie@example.com",
		passkeyName: "Work laptop",
		changedAt: epochMs(Date.now()),
	};

	public readonly key: string = "passkey-removed";
	public readonly propsSchema = PasskeyChangedEmailPropsSchema;
	public readonly subject: string = "A passkey was removed from your account";
	protected readonly accent: EmailAccent = "amber";
	protected readonly eyebrow: string = "Security";
	protected readonly heading: string = "Passkey removed";

	public getPreviewText(context: EmailRenderContext): string {
		return `A passkey was removed from your ${context.appName} account.`;
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return [
			this.paragraph(`The passkey ${this.strong(this.props.passkeyName)} can no longer sign in to your ${this.strong(context.appName)} account.`),
			this.note("If you did not remove it, change your password and review your security settings."),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`The passkey "${this.props.passkeyName}" can no longer sign in to your ${context.appName} account.`,
			"",
			"If you did not remove it, change your password and review your security settings.",
		].join("\n");
	}
}
