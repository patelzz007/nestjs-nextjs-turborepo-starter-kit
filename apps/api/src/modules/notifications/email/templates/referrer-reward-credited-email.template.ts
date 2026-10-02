import { ReferrerRewardCreditedEmailPropsSchema, type ReferrerRewardCreditedEmailProps, APP_LINKS } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/** Sent when a referral redeems and the referrer earns R′. */
export class ReferrerRewardCreditedEmailTemplate extends BaseEmailTemplate<ReferrerRewardCreditedEmailProps> {
	public static readonly sampleProps: ReferrerRewardCreditedEmailProps = {
		to: "alice@example.com",
		rewardTitle: "Free coffee — Referrer bonus",
		claimExpiresDays: 30,
	};

	public readonly key: string = "referrer-reward-credited";
	public readonly propsSchema = ReferrerRewardCreditedEmailPropsSchema;
	public readonly subject: string = "You earned a referrer reward!";
	protected readonly accent: EmailAccent = "green";
	protected readonly eyebrow: string = "Referrals";
	protected readonly heading: string = "Referral reward unlocked";

	public getPreviewText(_context: EmailRenderContext): string {
		return `Claim "${this.props.rewardTitle}" within ${String(this.props.claimExpiresDays)} days.`;
	}

	public override getCta(context: EmailRenderContext): CtaConfig | null {
		return {
			label: "View my rewards",
			href: this.buildUrl(context, APP_LINKS.web.wallet),
		};
	}

	public renderBodyHtml(_context: EmailRenderContext): string {
		return [
			this.paragraph("Someone you referred just redeemed a reward — so you earned one too:"),
			this.highlight(this.props.rewardTitle, `Claim it within ${String(this.props.claimExpiresDays)} days before it expires.`),
		].join("");
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return ["Someone you referred just redeemed a reward.", "", `Your reward: ${this.props.rewardTitle}`, `Claim within ${String(this.props.claimExpiresDays)} days.`].join(
			"\n",
		);
	}
}
