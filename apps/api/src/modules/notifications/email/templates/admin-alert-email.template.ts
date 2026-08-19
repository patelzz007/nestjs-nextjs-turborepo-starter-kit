import {
	AdminAlertEmailPropsSchema,
	type AdminAlertEmailProps,
} from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/**
 * Ops alert for admins (failed webhook, quota breach, anomalous sign-in rate,
 * …). Indigo accent. The subject is prefixed with "[Admin]" so ops filters
 * catch it instantly.
 */
export class AdminAlertEmailTemplate extends BaseEmailTemplate<AdminAlertEmailProps> {
	/** Sample props used by the admin preview + screenshot pipeline. */
	public static readonly sampleProps: AdminAlertEmailProps = {
		to: "ops@example.com",
		title: "Webhook delivery failing",
		message: "The Resend webhook has not delivered an event in the last 15 minutes.\n\nPlease check the dashboard and the delivery logs.",
	};

	public readonly key: string = "admin-alert";
	public readonly propsSchema = AdminAlertEmailPropsSchema;
	// Class fields initialize after the base constructor assigns `props`, so
	// reading `this.props.title` here is safe.
	public readonly subject: string = `[Admin] ${this.props.title}`;
	protected readonly accent: EmailAccent = "indigo";
	protected readonly eyebrow: string = "Admin Alert";
	protected readonly heading: string = this.props.title;

	public getPreviewText(context: EmailRenderContext): string {
		return `${this.props.title} — action may be required on ${context.appName}.`;
	}

	public getCta(context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Open Admin Panel",
			href: this.buildUrl(context, "/"),
		};
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		const paragraphs: readonly string[] = this.props.message.split(/\n{2,}/);
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">An automated alert from <strong>${this.escape(context.appName)}</strong>:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 20px 0;">
          <tr>
            <td class="email-chip" style="background: ${this.palette.chipBg}; border: 1px solid ${this.palette.chipBorder}; border-radius: 10px; padding: 18px 20px;">
              ${paragraphs.map((paragraph: string): string => `<p class="email-text" style="color: #334155; font-size: 14px; line-height: 1.7; margin: 0 0 8px 0; white-space: pre-line;">${this.escape(paragraph)}</p>`).join("")}
            </td>
          </tr>
        </table>`;
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [`An automated alert from ${context.appName}:`, "", this.props.title, "", this.props.message].join("\n");
	}
}
