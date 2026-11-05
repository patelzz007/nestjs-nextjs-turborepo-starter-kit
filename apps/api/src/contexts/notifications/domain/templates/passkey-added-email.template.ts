import { PasskeyChangedEmailPropsSchema, epochMs, type EmailAccent, type PasskeyChangedEmailProps } from "@workspace/shared";

import { BaseEmailTemplate } from "./base/base-email-template";
import type { EmailRenderContext } from "./base/email-render-context";

/** Sent when a passkey is added to an account (ADR 080): a new sign-in credential is always announced. */
export class PasskeyAddedEmailTemplate extends BaseEmailTemplate<PasskeyChangedEmailProps> {
	public static readonly sampleProps: PasskeyChangedEmailProps = {
		to: "jamie@example.com",
		passkeyName: "Work laptop",
		changedAt: epochMs(Date.now()),
	};

	public readonly key: string = "passkey-added";
	public readonly propsSchema = PasskeyChangedEmailPropsSchema;
	public readonly subject: string = "A passkey was added to your account";
	protected readonly accent: EmailAccent = "green";
	protected readonly eyebrow: string = "Security";
	protected readonly heading: string = "New passkey added";

	public getPreviewText(context: EmailRenderContext): string {
		return `A passkey was added to your ${context.appName} account.`;
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return [
			this.paragraph(`The passkey ${this.strong(this.props.passkeyName)} can now sign in to your ${this.strong(context.appName)} account.`),
			this.note("If you did not add it, change your password and remove the passkey from your security settings right away."),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`The passkey "${this.props.passkeyName}" can now sign in to your ${context.appName} account.`,
			"",
			"If you did not add it, change your password and remove the passkey from your security settings right away.",
		].join("\n");
	}
}
