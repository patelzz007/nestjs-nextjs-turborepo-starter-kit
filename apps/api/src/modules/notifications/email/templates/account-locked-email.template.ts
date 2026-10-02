import { AccountLockedEmailPropsSchema, epochMs, type AccountLockedEmailProps, type EmailAccent, APP_LINKS } from "@workspace/shared";

import { BaseEmailTemplate } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/**
 * Sent after brute-force lockout. Uses the red accent and a soft chip to make
 * the "locked for N minutes" fact impossible to miss.
 */
export class AccountLockedEmailTemplate extends BaseEmailTemplate<AccountLockedEmailProps> {
	/** Sample props used by the admin preview + screenshot pipeline. */
	public static readonly sampleProps: AccountLockedEmailProps = {
		to: "jamie@example.com",
		lockedUntil: epochMs(Date.now() + 15 * 60 * 1000),
	};

	public readonly key: string = "account-locked";
	public readonly propsSchema = AccountLockedEmailPropsSchema;
	public readonly subject: string = "Your account was temporarily locked";
	protected readonly accent: EmailAccent = "red";
	protected readonly eyebrow: string = "Security Notice";
	protected readonly heading: string = "Account temporarily locked";

	public getPreviewText(context: EmailRenderContext): string {
		return `Too many failed sign-in attempts on your ${context.appName} account.`;
	}

	/** Remaining lock duration in whole minutes (min 1). */
	private get remainingMinutes(): number {
		const remainingMs: number = this.props.lockedUntil - Date.now();
		return Math.max(1, Math.ceil(remainingMs / 60_000));
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		const minutes: number = this.remainingMinutes;
		return [
			this.paragraph(`Your ${this.strong(context.appName)} account was temporarily locked after too many failed sign-in attempts.`),
			this.highlight(`Locked for ${String(minutes)} minute${minutes === 1 ? "" : "s"}`, "You can try again once this period ends."),
			this.paragraph(`Forgot your password? ${this.link(this.buildUrl(context, APP_LINKS.auth.forgotPassword), "Request a reset")} from the sign-in page.`),
			this.note("If this wasn't you, someone may be trying to access your account — please contact support."),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		const minutes: number = this.remainingMinutes;
		return [
			`Your ${context.appName} account was temporarily locked after too many failed sign-in attempts.`,
			"",
			`Locked for ${String(minutes)} minute${minutes === 1 ? "" : "s"}.`,
			"You'll be able to try again after this period ends.",
			"",
			`Forgot your password? Request a reset at ${this.buildUrl(context, APP_LINKS.auth.forgotPassword)}`,
			"",
			"If this wasn't you, someone else may be trying to access your account — please contact support.",
		].join("\n");
	}
}
