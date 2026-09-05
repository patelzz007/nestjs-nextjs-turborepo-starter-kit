import { RewardClaimOtpEmailPropsSchema, type RewardClaimOtpEmailProps } from "@workspace/shared";

import { BaseEmailTemplate, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/** Claim OTP via email — Twilio-free dev/staging path. */
export class RewardClaimOtpEmailTemplate extends BaseEmailTemplate<RewardClaimOtpEmailProps> {
	public static readonly sampleProps: RewardClaimOtpEmailProps = {
		to: "alice@example.com",
		rewardTitle: "Free coffee — Grand Opening",
		otpCode: "482916",
		expiresInMinutes: 5,
	};

	public readonly key: string = "reward-claim-otp";
	public readonly propsSchema = RewardClaimOtpEmailPropsSchema;
	public readonly subject: string = "Your reward claim code";
	protected readonly accent: EmailAccent = "sky";
	protected readonly eyebrow: string = "Rewards";
	protected readonly heading: string = "Claim verification code";

	public getPreviewText(_context: EmailRenderContext): string {
		return `Use code ${this.props.otpCode} to claim "${this.props.rewardTitle}".`;
	}

	public renderBodyHtml(_context: EmailRenderContext): string {
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Enter this code to claim <strong>${this.escape(this.props.rewardTitle)}</strong>:</p>
        ${this.otpCodeBlock(this.props.otpCode)}
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">Expires in ${String(this.props.expiresInMinutes)} minutes. If you didn't request this, ignore this email.</p>`;
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return [
			`Claim code for "${this.props.rewardTitle}":`,
			"",
			this.props.otpCode,
			"",
			`Expires in ${String(this.props.expiresInMinutes)} minutes.`,
			"If you didn't request this, ignore this email.",
		].join("\n");
	}
}
