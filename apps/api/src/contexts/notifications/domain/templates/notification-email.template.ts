import { NotificationEmailPropsSchema, type CtaConfig, type EmailAccent, type NotificationEmailProps } from "@workspace/shared";

import { type EmailAttachmentSource, type EmailUnsubscribeLinks, BaseEmailTemplate } from "./base/base-email-template";
import type { EmailRenderContext } from "./base/email-render-context";

/** One catalog notification as an email (ADR 070): the words come from the type's email renderer. */
export class NotificationEmailTemplate extends BaseEmailTemplate<NotificationEmailProps> {
	public static readonly sampleProps: NotificationEmailProps = {
		to: "jamie@example.com",
		subject: "You earned a referrer reward",
		eyebrow: "Referral reward",
		heading: "Your referral paid off",
		paragraphs: ["Someone you referred redeemed a reward.", 'Claim "Free latte" within 14 days.'],
		actionLabel: "Claim your reward",
		actionUrl: "https://app.example.com/rewards",
		attachmentName: "weekend-offer.webp",
		attachmentUrl: "https://cdn.example.com/weekend-offer.webp",
		attachmentPreviewUrl: "https://cdn.example.com/weekend-offer-1280.webp",
		unsubscribeUrl: "https://app.example.com/unsubscribe?token=sample",
		oneClickUnsubscribeUrl: "https://api.example.com/api/v1/notifications/unsubscribe/one-click?token=sample",
	};

	public readonly key: string = "notification";
	public readonly propsSchema = NotificationEmailPropsSchema;
	protected readonly accent: EmailAccent = "sky";

	public get subject(): string {
		return this.props.subject;
	}

	protected get eyebrow(): string {
		return this.props.eyebrow;
	}

	protected get heading(): string {
		return this.props.heading;
	}

	public getPreviewText(): string {
		return this.props.paragraphs.join(" ");
	}

	public override getCta(): CtaConfig | null {
		return this.props.actionLabel === undefined || this.props.actionUrl === undefined ? null : { label: this.props.actionLabel, href: this.props.actionUrl };
	}

	public override attachmentSources(): readonly EmailAttachmentSource[] {
		const { attachmentName, attachmentUrl } = this.props;
		return attachmentName === undefined || attachmentUrl === undefined ? [] : [{ filename: attachmentName, url: attachmentUrl }];
	}

	public override unsubscribeLinks(): EmailUnsubscribeLinks | null {
		return this.props.unsubscribeUrl === undefined || this.props.oneClickUnsubscribeUrl === undefined
			? null
			: { pageUrl: this.props.unsubscribeUrl, oneClickUrl: this.props.oneClickUnsubscribeUrl };
	}

	public renderBodyHtml(_context: EmailRenderContext): string {
		return this.props.paragraphs.map((paragraph: string): string => this.paragraph(this.escape(paragraph))).join("") + this.attachmentHtml();
	}

	public renderBodyText(_context: EmailRenderContext): string {
		const { attachmentName, attachmentUrl } = this.props;
		const attachment = attachmentName === undefined || attachmentUrl === undefined ? [] : [`Attachment: ${attachmentName}\n${attachmentUrl}`];
		return [...this.props.paragraphs, ...attachment].join("\n\n");
	}

	/** The attachment: a picture shows its smaller copy and opens the full file; any other file is a link. */
	private attachmentHtml(): string {
		const { attachmentName, attachmentUrl, attachmentPreviewUrl } = this.props;
		if (attachmentName === undefined || attachmentUrl === undefined) {
			return "";
		}
		const picture =
			attachmentPreviewUrl === undefined
				? ""
				: `<a href="${this.escape(attachmentUrl)}"><img src="${this.escape(attachmentPreviewUrl)}" alt="${this.escape(attachmentName)}" width="100%" style="display: block; width: 100%; height: auto; border-radius: 8px; margin: 0 0 8px 0;" /></a>`;
		return `${picture}${this.paragraph(this.link(attachmentUrl, attachmentName))}`;
	}
}
