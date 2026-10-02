import { AdminAlertEmailPropsSchema, type AdminAlertEmailProps } from "@workspace/shared";

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
		action: { label: "Open admin panel", url: "https://admin.example.com/" },
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

	public override getCta(_context: EmailRenderContext): CtaConfig | null {
		return this.props.action === undefined ? null : { label: this.props.action.label, href: this.props.action.url };
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		const paragraphs: readonly string[] = this.props.message.split(/\n{2,}/);
		return [
			this.paragraph(`An automated alert from ${this.strong(context.appName)}:`),
			paragraphs.map((paragraph: string): string => this.callout(this.props.title, paragraph)).join(""),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [`An automated alert from ${context.appName}:`, "", this.props.title, "", this.props.message].join("\n");
	}
}
