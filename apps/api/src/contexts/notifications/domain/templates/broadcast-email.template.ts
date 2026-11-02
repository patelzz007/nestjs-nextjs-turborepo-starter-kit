import { BroadcastEmailPropsSchema, type BroadcastEmailProps, type EmailAccent } from "@workspace/shared";

import { type EmailUnsubscribeLinks, BaseEmailTemplate } from "./base/base-email-template";
import type { EmailRenderContext } from "./base/email-render-context";

/**
 * A broadcast (ADR 073). `bodyHtml` is the server's own rendering of the validated rich-text JSON
 * (`render-rich-text.ts`): every text is escaped there and every link is https, so it is inserted as is.
 * The sender's name is the display name; the address stays the platform's.
 */
export class BroadcastEmailTemplate extends BaseEmailTemplate<BroadcastEmailProps> {
	public static readonly sampleProps: BroadcastEmailProps = {
		to: "jamie@example.com",
		senderName: "Acme Coffee",
		title: "Weekend 2-for-1 on all lattes",
		bodyHtml: '<p style="margin: 0 0 16px 0;">Bring a friend this Saturday and the second latte is on us.</p>',
		bodyText: "Bring a friend this Saturday and the second latte is on us.",
		unsubscribeUrl: "https://app.example.com/unsubscribe?token=sample",
		oneClickUnsubscribeUrl: "https://api.example.com/api/v1/notifications/unsubscribe/one-click?token=sample",
	};

	public readonly key: string = "broadcast";
	public readonly propsSchema = BroadcastEmailPropsSchema;
	protected readonly accent: EmailAccent = "sky";

	public get subject(): string {
		return this.props.title;
	}

	protected get eyebrow(): string {
		return this.props.senderName;
	}

	protected get heading(): string {
		return this.props.title;
	}

	public getPreviewText(): string {
		return this.props.bodyText;
	}

	public override unsubscribeLinks(): EmailUnsubscribeLinks {
		return { pageUrl: this.props.unsubscribeUrl, oneClickUrl: this.props.oneClickUnsubscribeUrl };
	}

	public renderBodyHtml(_context: EmailRenderContext): string {
		return this.props.bodyHtml;
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return this.props.bodyText;
	}
}
