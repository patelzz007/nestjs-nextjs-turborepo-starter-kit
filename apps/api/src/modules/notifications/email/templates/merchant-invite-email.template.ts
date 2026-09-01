import { MerchantInviteEmailPropsSchema, type MerchantInviteEmailProps } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/** Sent when a platform admin creates a merchant onboarding invite. */
export class MerchantInviteEmailTemplate extends BaseEmailTemplate<MerchantInviteEmailProps> {
	public static readonly sampleProps: MerchantInviteEmailProps = {
		to: "owner@cafe.demo",
		businessName: "Sunrise Café",
		cityLabel: "Kuala Lumpur",
		inviteUrl: "https://merchant.example.com/onboarding?token=demo-invite-token",
		expiresInDays: 7,
	};

	public readonly key: string = "merchant-invite";
	public readonly propsSchema = MerchantInviteEmailPropsSchema;
	public readonly subject: string = "You're invited to join the rewards marketplace";
	protected readonly accent: EmailAccent = "amber";
	protected readonly eyebrow: string = "Merchant onboarding";
	protected readonly heading: string = "Set up your merchant account";

	public getPreviewText(_context: EmailRenderContext): string {
		return `Complete onboarding for ${this.props.businessName} in ${this.props.cityLabel}.`;
	}

	public getCta(_context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Start onboarding",
			href: this.props.inviteUrl,
		};
	}

	public renderBodyHtml(_context: EmailRenderContext): string {
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">You've been invited to onboard <strong>${this.escape(this.props.businessName)}</strong> in the <strong>${this.escape(this.props.cityLabel)}</strong> pilot.</p>
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">Use the button below to create your merchant account and complete KYB.</p>
        ${this.linkBlock(this.props.inviteUrl)}
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 6px 0;">This invite expires in <strong>${String(this.props.expiresInDays)} days</strong>.</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">If you weren't expecting this, you can ignore this email.</p>
        <p class="email-muted" style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 16px 0 0 0; font-family: ui-monospace, monospace;">${this.escape(this.props.inviteUrl)}</p>`;
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return [
			`You've been invited to onboard ${this.props.businessName} in the ${this.props.cityLabel} pilot.`,
			"",
			"Open this link to start onboarding:",
			this.props.inviteUrl,
			"",
			`This invite expires in ${String(this.props.expiresInDays)} days.`,
			"If you weren't expecting this, you can ignore this email.",
		].join("\n");
	}
}
