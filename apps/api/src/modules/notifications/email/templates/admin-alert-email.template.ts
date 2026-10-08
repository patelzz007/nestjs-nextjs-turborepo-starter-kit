import { AdminAlertEmailPropsSchema, type AdminAlertEmailProps } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/**
 * Ops alert for admins (failed webhook, quota breach, anomalous sign-in rate,
 * …). Indigo accent. The subject is prefixed with "[Admin]" so ops filters
 * catch it instantly. The title appears once, as the heading; the body is the
 * message itself.
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
	protected readonly eyebrow: string = "Admin alert";
	protected readonly heading: string = this.props.title;

	public getPreviewText(context: EmailRenderContext): string {
		return `${this.props.title} — action may be required on ${context.appName}.`;
	}

	/** The button follows the message, above the muted source line. */
	protected override readonly ctaPlacement = "in-body";

	public override getCta(_context: EmailRenderContext): CtaConfig | null {
		return this.props.action === undefined ? null : { label: this.props.action.label, href: this.props.action.url };
	}

	/** The message's paragraphs (blank-line separated), as written by the caller. */
	private get messageParagraphs(): readonly string[] {
		return this.props.message.split(/\n{2,}/).filter((paragraph: string): boolean => paragraph.trim().length > 0);
	}

	// The title is already the heading (and the subject), so the body never repeats it: the
	// message reads as plain paragraphs, and only the source line below it is muted.
	public renderBodyHtml(context: EmailRenderContext): string {
		return [
			...this.messageParagraphs.map((paragraph: string): string => this.paragraph(this.escape(paragraph))),
			this.ctaInBody(context),
			this.note(`Sent automatically by ${this.strong(context.appName)} monitoring.`),
		].join("");
	}

	public renderBodyText(context: EmailRenderContext): string {
		return [this.messageParagraphs.join("\n\n"), "", `Sent automatically by ${context.appName} monitoring.`].join("\n");
	}
}
