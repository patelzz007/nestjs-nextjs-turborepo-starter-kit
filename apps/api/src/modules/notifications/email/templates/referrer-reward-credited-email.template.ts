import { ReferrerRewardCreditedEmailPropsSchema, type ReferrerRewardCreditedEmailProps } from "@workspace/shared";

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

	public getCta(context: EmailRenderContext): CtaConfig | null {
		return {
			label: "View My Rewards",
			href: this.buildUrl(context, "/rewards/claims"),
		};
	}

	public renderBodyHtml(_context: EmailRenderContext): string {
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Someone you referred just redeemed a reward. You earned:</p>
        <p class="email-text" style="color: #0f172a; font-size: 17px; font-weight: 600; margin: 0 0 16px 0;">${this.escape(this.props.rewardTitle)}</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">Claim within <strong>${String(this.props.claimExpiresDays)} days</strong> before it expires.</p>`;
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return ["Someone you referred just redeemed a reward.", "", `Your reward: ${this.props.rewardTitle}`, `Claim within ${String(this.props.claimExpiresDays)} days.`].join(
			"\n",
		);
	}
}
