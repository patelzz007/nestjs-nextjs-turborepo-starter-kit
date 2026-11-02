import { NotificationDigestEmailPropsSchema, type EmailAccent, type NotificationDigestEmailProps } from "@workspace/shared";

import { type EmailUnsubscribeLinks, BaseEmailTemplate } from "./base/base-email-template";
import type { EmailRenderContext } from "./base/email-render-context";

/** The daily or weekly digest (ADR 070): one email instead of one per notification. */
export class NotificationDigestEmailTemplate extends BaseEmailTemplate<NotificationDigestEmailProps> {
	public static readonly sampleProps: NotificationDigestEmailProps = {
		to: "jamie@example.com",
		period: "DAILY",
		itemTitles: ["You earned a referrer reward", "Referral successful"],
		itemBodies: ['Claim "Free latte" within 14 days.', "Jane Tan redeemed a reward."],
		itemLinks: ["https://app.example.com/rewards", "https://app.example.com/referrals"],
		unsubscribeUrl: "https://app.example.com/unsubscribe?token=sample",
		oneClickUnsubscribeUrl: "https://api.example.com/api/v1/notifications/unsubscribe/one-click?token=sample",
	};

	public readonly key: string = "notification-digest";
	public readonly propsSchema = NotificationDigestEmailPropsSchema;
	protected readonly accent: EmailAccent = "sky";
	protected readonly eyebrow: string = "Your digest";

	public get subject(): string {
		return this.props.period === "DAILY" ? "Your daily summary" : "Your weekly summary";
	}

	protected get heading(): string {
		return `${String(this.props.itemTitles.length)} update${this.props.itemTitles.length === 1 ? "" : "s"} for you`;
	}

	public getPreviewText(): string {
		return this.props.itemTitles.join(" · ");
	}

	public override unsubscribeLinks(): EmailUnsubscribeLinks | null {
		return this.props.unsubscribeUrl === undefined || this.props.oneClickUnsubscribeUrl === undefined
			? null
			: { pageUrl: this.props.unsubscribeUrl, oneClickUrl: this.props.oneClickUnsubscribeUrl };
	}

	public renderBodyHtml(_context: EmailRenderContext): string {
		return this.props.itemTitles
			.map((title: string, index: number): string => {
				const body = this.props.itemBodies.at(index) ?? "";
				const link = this.props.itemLinks.at(index) ?? "";
				const heading = link === "" ? this.strong(title) : this.link(link, title);
				return this.paragraph(`${heading}<br>${this.escape(body)}`);
			})
			.join("");
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return this.props.itemTitles
			.map((title: string, index: number): string =>
				[title, this.props.itemBodies.at(index) ?? "", this.props.itemLinks.at(index) ?? ""].filter((line: string): boolean => line !== "").join("\n"),
			)
			.join("\n\n");
	}
}
