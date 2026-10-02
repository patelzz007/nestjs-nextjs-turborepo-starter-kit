import { nowEpochMs, SecurityAlertEmailPropsSchema, type SecurityAlertEmailProps, APP_LINKS } from "@workspace/shared";

import { BaseEmailTemplate, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/**
 * New-device / new-location sign-in alert. Amber accent — urgent but not
 * alarmist. No CTA button; the actionable link lives in the body so the
 * recipient can't click "secure account" in panic.
 */
export class SecurityAlertEmailTemplate extends BaseEmailTemplate<SecurityAlertEmailProps> {
	/** Sample props used by the admin preview + screenshot pipeline. */
	public static readonly sampleProps: SecurityAlertEmailProps = {
		to: "jamie@example.com",
		deviceLabel: "Chrome on macOS",
		location: "Kuala Lumpur, MY",
		signedInAt: nowEpochMs(),
	};

	public readonly key: string = "security-alert";
	public readonly propsSchema = SecurityAlertEmailPropsSchema;
	public readonly subject: string = "New sign-in to your account";
	protected readonly accent: EmailAccent = "amber";
	protected readonly eyebrow: string = "Security Alert";
	protected readonly heading: string = "A new device signed in";

	public getPreviewText(context: EmailRenderContext): string {
		return `We noticed a new sign-in to your ${context.appName} account. Was it you?`;
	}

	/** "2 minutes ago"-style relative label. */
	private get signedInLabel(): string {
		if (!this.props.signedInAt) {
			return "recently";
		}
		const elapsedMs: number = Date.now() - this.props.signedInAt;
		if (elapsedMs < 60_000) {
			return "just now";
		}
		const minutes: number = Math.floor(elapsedMs / 60_000);
		if (minutes < 60) {
			return `${String(minutes)} minute${minutes === 1 ? "" : "s"} ago`;
		}
		const hours: number = Math.floor(minutes / 60);
		return `${String(hours)} hour${hours === 1 ? "" : "s"} ago`;
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return [
			this.paragraph(`We noticed a new sign-in to your ${this.strong(context.appName)} account ${this.strong(this.signedInLabel)}.`),
			this.detailsCard([
				{ label: "Device", value: this.props.deviceLabel ?? "A device you may not recognize" },
				{ label: "Location", value: this.props.location ?? "Unknown location" },
				{ label: "When", value: this.signedInLabel },
			]),
			this.paragraph("Was this you? You're all set — no action needed."),
			this.callout("Didn't sign in?", "Reset your password now and sign out of any sessions you don't recognize."),
			this.note(
				`${this.link(this.buildUrl(context, APP_LINKS.auth.forgotPassword), "Reset password")} · ${this.link(this.buildUrl(context, APP_LINKS.web.account), "Review active sessions")}`,
			),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`We noticed a sign-in to your ${context.appName} account ${this.signedInLabel}:`,
			`- Device: ${this.props.deviceLabel ?? "unknown"}`,
			`- Location: ${this.props.location ?? "unknown"}`,
			"",
			"Was this you? You're all set — no action needed.",
			`If it wasn't, reset your password at ${this.buildUrl(context, APP_LINKS.auth.forgotPassword)} and review your sessions at ${this.buildUrl(context, APP_LINKS.web.account)}`,
		].join("\n");
	}
}
