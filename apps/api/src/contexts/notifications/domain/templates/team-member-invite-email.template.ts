import { TeamMemberInviteEmailPropsSchema, type TeamMemberInviteEmailProps } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "./base/base-email-template";
import type { EmailRenderContext } from "./base/email-render-context";

/** Sent when a tenant owner/admin invites a colleague to join their team. */
export class TeamMemberInviteEmailTemplate extends BaseEmailTemplate<TeamMemberInviteEmailProps> {
	public static readonly sampleProps: TeamMemberInviteEmailProps = {
		to: "alice@cafe.demo",
		tenantName: "Brew & Bean KL",
		roleLabel: "Cashier",
		locationSummary: "Bukit Bintang",
		inviteUrl: "https://merchant.example.com/team-invite?token=demo-team-invite-token",
		expiresInDays: 7,
	};

	public readonly key: string = "team-member-invite";
	public readonly propsSchema = TeamMemberInviteEmailPropsSchema;
	public readonly subject: string = "You've been invited to join a team";
	protected readonly accent: EmailAccent = "sky";
	protected readonly eyebrow: string = "Team invitation";
	protected readonly heading: string = "Join your tenant's team";

	public getPreviewText(_context: EmailRenderContext): string {
		return `Accept your invite to join ${this.props.tenantName} as ${this.props.roleLabel}.`;
	}

	/** The button sits in the body, above the copy-link fallback. */
	protected override readonly ctaPlacement = "in-body";

	public override getCta(_context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Accept invitation",
			href: this.props.inviteUrl,
		};
	}

	public renderBodyHtml(context: EmailRenderContext): string {
		return [
			this.paragraph(`You've been invited to join ${this.strong(this.props.tenantName)}.`),
			this.detailsCard([
				{ label: "Tenant", value: this.props.tenantName },
				{ label: "Role", value: this.props.roleLabel },
				{ label: "Location access", value: this.props.locationSummary },
				{ label: "Invite expires", value: `In ${String(this.props.expiresInDays)} days` },
			]),
			this.paragraph("Sign in with this email address and accept the invite to get started."),
			this.ctaInBody(context),
			this.linkBlock(this.props.inviteUrl),
			this.note("Weren't expecting this? You can ignore this email."),
		].join("");
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return [
			`You've been invited to join ${this.props.tenantName} as ${this.props.roleLabel}.`,
			`Location access: ${this.props.locationSummary}.`,
			"",
			"Open this link to accept the invitation:",
			this.props.inviteUrl,
			"",
			`This invite expires in ${String(this.props.expiresInDays)} days.`,
			"If you weren't expecting this, you can ignore this email.",
		].join("\n");
	}
}
