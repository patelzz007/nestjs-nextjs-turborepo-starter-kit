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

	/** The button sits in the body, above the copy-link fallback. */
	protected override readonly ctaPlacement = "in-body";

	public override getCta(_context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Start onboarding",
			href: this.props.inviteUrl,
		};
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return [
			this.paragraph(`You're invited to bring ${this.strong(this.props.businessName)} onto the ${this.strong(this.props.cityLabel)} pilot.`),
			this.detailsCard([
				{ label: "Business", value: this.props.businessName },
				{ label: "City", value: this.props.cityLabel },
				{ label: "Invite expires", value: `In ${String(this.props.expiresInDays)} days` },
			]),
			this.paragraph("Create your merchant account and complete verification (KYB) to start publishing offers."),
			this.ctaInBody(context),
			this.linkBlock(this.props.inviteUrl),
			this.note("Weren't expecting this? You can ignore this email."),
		].join("");
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
