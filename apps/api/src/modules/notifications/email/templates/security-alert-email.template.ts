import { z } from "zod";

import { BaseEmailPropsSchema, BaseEmailTemplate } from "../base/base-email-template.js";
import type { EmailRenderContext } from "../base/email-render-context.js";

export const SecurityAlertEmailPropsSchema = BaseEmailPropsSchema.extend({
	/** Human-readable device description (e.g. "Chrome on macOS"). */
	deviceLabel: z.string().min(1).optional(),
	/** Approximate location from IP geo (e.g. "Kuala Lumpur, MY"). */
	location: z.string().min(1).optional(),
	/** When the sign-in happened (ISO). */
	signedInAt: z.iso.datetime().optional(),
});

export type SecurityAlertEmailProps = z.output<typeof SecurityAlertEmailPropsSchema>;

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
		signedInAt: new Date().toISOString(),
	};

	public readonly key: string = "security-alert";
	public readonly propsSchema = SecurityAlertEmailPropsSchema;
	public readonly subject: string = "New sign-in to your account";
	protected readonly accent = "amber" as const;
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
		const elapsedMs: number = Date.now() - new Date(this.props.signedInAt).getTime();
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
		const detailLines: readonly string[] = [this.props.deviceLabel ?? "A device you may not recognize", this.props.location ?? "Unknown location"];
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">We noticed a sign-in to your <strong>${this.escape(context.appName)}</strong> account <strong>${this.escape(this.signedInLabel)}</strong>:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 20px 0;">
          <tr>
            <td class="email-chip" style="background: ${this.palette.chipBg}; border: 1px solid ${this.palette.chipBorder}; border-radius: 10px; padding: 16px 18px;">
              ${detailLines.map((line: string): string => `<p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: ${this.palette.chipText};">${this.escape(line)}</p>`).join("")}
            </td>
          </tr>
        </table>
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 8px 0;">Was this you? You're all set — no action needed.</p>
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">If it wasn't, please <a href="${this.escape(this.buildUrl(context, "/auth/reset-password"))}" style="color: #2563eb; text-decoration: underline;">reset your password</a> and review your <a href="${this.escape(this.buildUrl(context, "/settings/sessions"))}" style="color: #2563eb; text-decoration: underline;">active sessions</a>.</p>`;
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [
			`We noticed a sign-in to your ${context.appName} account ${this.signedInLabel}:`,
			`- Device: ${this.props.deviceLabel ?? "unknown"}`,
			`- Location: ${this.props.location ?? "unknown"}`,
			"",
			"Was this you? You're all set — no action needed.",
			"If it wasn't, reset your password at " + `${context.appUrl}/auth/reset-password` + " and review your sessions at " + `${context.appUrl}/settings/sessions`,
		].join("\n");
	}
}
