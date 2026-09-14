import { TeamMemberInviteEmailPropsSchema, type TeamMemberInviteEmailProps } from "@workspace/shared";

import { BaseEmailTemplate, type CtaConfig, type EmailAccent } from "../base/base-email-template";
import type { EmailRenderContext } from "../base/email-render-context";

/** Sent when an organization owner/admin invites a colleague to join their team. */
export class TeamMemberInviteEmailTemplate extends BaseEmailTemplate<TeamMemberInviteEmailProps> {
	public static readonly sampleProps: TeamMemberInviteEmailProps = {
		to: "alice@cafe.demo",
		organizationName: "Brew & Bean KL",
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
	protected readonly heading: string = "Join your organization's team";

	public getPreviewText(_context: EmailRenderContext): string {
		return `Accept your invite to join ${this.props.organizationName} as ${this.props.roleLabel}.`;
	}

	public getCta(_context: EmailRenderContext): CtaConfig | null {
		return {
			label: "Accept invitation",
			href: this.props.inviteUrl,
		};
	}

	public renderBodyHtml(_context: EmailRenderContext): string {
		return `
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">You've been invited to join <strong>${this.escape(this.props.organizationName)}</strong> as <strong>${this.escape(this.props.roleLabel)}</strong>.</p>
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Location access: <strong>${this.escape(this.props.locationSummary)}</strong>.</p>
        <p class="email-text" style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">Sign in with this email address and accept the invite to get started.</p>
        ${this.linkBlock(this.props.inviteUrl)}
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 6px 0;">This invite expires in <strong>${String(this.props.expiresInDays)} days</strong>.</p>
        <p class="email-muted" style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">If you weren't expecting this, you can ignore this email.</p>
        <p class="email-muted" style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 16px 0 0 0; font-family: ui-monospace, monospace;">${this.escape(this.props.inviteUrl)}</p>`;
	}

	public renderBodyText(_context: EmailRenderContext): string {
		return [
			`You've been invited to join ${this.props.organizationName} as ${this.props.roleLabel}.`,
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
