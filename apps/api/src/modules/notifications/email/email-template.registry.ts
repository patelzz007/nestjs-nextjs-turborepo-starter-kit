import {
	AccountLockedEmailPropsSchema,
	AdminAlertEmailPropsSchema,
	ApiKeyCreatedEmailPropsSchema,
	EmailPreviewPropValueSchema,
	EmailPreviewSchema,
	EmailTemplateMetaSchema,
	LoginVerificationEmailPropsSchema,
	MerchantInviteEmailPropsSchema,
	PasswordChangedEmailPropsSchema,
	PasswordResetEmailPropsSchema,
	ReferrerRewardCreditedEmailPropsSchema,
	RewardClaimOtpEmailPropsSchema,
	SecurityAlertEmailPropsSchema,
	TeamMemberInviteEmailPropsSchema,
	TwoFactorStatusEmailPropsSchema,
	VerificationEmailPropsSchema,
	WelcomeEmailPropsSchema,
	type EmailJobPropValue,
	type EmailPreview,
	type EmailTemplateKey,
	type EmailTemplateMeta,
} from "@workspace/shared";

import { BaseEmailTemplate, type BaseEmailProps } from "./base/base-email-template";
import type { EmailRenderContext } from "./base/email-render-context";
import { AccountLockedEmailTemplate } from "./templates/account-locked-email.template";
import { AdminAlertEmailTemplate } from "./templates/admin-alert-email.template";
import { ApiKeyCreatedEmailTemplate } from "./templates/api-key-created-email.template";
import { LoginVerificationEmailTemplate } from "./templates/login-verification-email.template";
import { MerchantInviteEmailTemplate } from "./templates/merchant-invite-email.template";
import { TeamMemberInviteEmailTemplate } from "./templates/team-member-invite-email.template";
import { PasswordChangedEmailTemplate } from "./templates/password-changed-email.template";
import { PasswordResetEmailTemplate } from "./templates/password-reset-email.template";
import { ReferrerRewardCreditedEmailTemplate } from "./templates/referrer-reward-credited-email.template";
import { RewardClaimOtpEmailTemplate } from "./templates/reward-claim-otp-email.template";
import { SecurityAlertEmailTemplate } from "./templates/security-alert-email.template";
import { TwoFactorDisabledEmailTemplate } from "./templates/two-factor-disabled-email.template";
import { TwoFactorEnabledEmailTemplate } from "./templates/two-factor-enabled-email.template";
import { VerificationEmailTemplate } from "./templates/verification-email.template";
import { WelcomeEmailTemplate } from "./templates/welcome-email.template";

/** A queued job's JSON-safe template props (see `serializeEmailTemplateProps`). */
export type EmailJobProps = Record<string, EmailJobPropValue>;

/** Static metadata, a sample-props factory and the queued-job rebuild for one template. */
export interface EmailTemplateEntry {
	/** Registry key — must match `EmailTemplateKeySchema`. */
	readonly key: EmailTemplateKey;
	/** Human label for the admin preview list. */
	readonly label: string;
	/** One-line description for the admin preview list. */
	readonly description: string;
	/** Sample `to` used by the admin preview list (never sent). */
	readonly sampleTo: string;
	/** The subject line with the sample props (some subjects interpolate props, e.g. the admin alert's title). */
	readonly sampleSubject: string;
	/** Builds a template instance with representative props. */
	readonly build: () => BaseEmailTemplate<BaseEmailProps>;
	/** Rebuilds the template from a queued job payload, re-validating the props through the template's schema. */
	readonly fromJobData: (props: EmailJobProps) => BaseEmailTemplate<BaseEmailProps>;
}

/** A concrete template class: constructible from its props, with static sample props. */
interface EmailTemplateClass<TProps extends BaseEmailProps> {
	new (props: TProps): BaseEmailTemplate<TProps>;
	readonly sampleProps: TProps;
}

/** The zod props schema of a template, as far as rebuilding a queued job needs it. */
interface EmailTemplatePropsParser<TProps extends BaseEmailProps> {
	parse(props: EmailJobProps): TProps;
}

/** Register a template: its metadata, its class and the schema its queued props are re-validated with. */
function registerTemplate<TProps extends BaseEmailProps>(
	key: EmailTemplateKey,
	label: string,
	description: string,
	Template: EmailTemplateClass<TProps>,
	propsSchema: EmailTemplatePropsParser<TProps>,
): EmailTemplateEntry {
	return {
		key,
		label,
		description,
		sampleTo: Template.sampleProps.to,
		sampleSubject: new Template(Template.sampleProps).subject,
		build: (): BaseEmailTemplate<BaseEmailProps> => new Template(Template.sampleProps),
		fromJobData: (props: EmailJobProps): BaseEmailTemplate<BaseEmailProps> => new Template(propsSchema.parse(props)),
	};
}

/**
 * Single source of truth for "which templates exist" — drives the admin
 * preview AND the rebuild of queued email jobs. The registry is keyed by the
 * shared `EmailTemplateKeySchema` — the completeness test in
 * `email-template.registry.spec.ts` fails if a key is added to the schema
 * without a registry entry (and vice versa).
 *
 * To add a new template: add the class import above, then add one entry below.
 */
export const EMAIL_TEMPLATE_REGISTRY: Readonly<Record<EmailTemplateKey, EmailTemplateEntry>> = {
	verification: registerTemplate(
		"verification",
		"Email Verification",
		"Sent after signup to prove the user owns the inbox.",
		VerificationEmailTemplate,
		VerificationEmailPropsSchema,
	),
	"password-reset": registerTemplate(
		"password-reset",
		"Password Reset",
		"Sent when a user requests a password reset.",
		PasswordResetEmailTemplate,
		PasswordResetEmailPropsSchema,
	),
	"password-changed": registerTemplate(
		"password-changed",
		"Password Changed",
		"Sent after an authenticated password change.",
		PasswordChangedEmailTemplate,
		PasswordChangedEmailPropsSchema,
	),
	"account-locked": registerTemplate(
		"account-locked",
		"Account Locked",
		"Sent after brute-force lockout with the remaining duration.",
		AccountLockedEmailTemplate,
		AccountLockedEmailPropsSchema,
	),
	welcome: registerTemplate("welcome", "Welcome", "One-time onboarding email after email verification.", WelcomeEmailTemplate, WelcomeEmailPropsSchema),
	"security-alert": registerTemplate(
		"security-alert",
		"Security Alert",
		"New-device / new-location sign-in alert.",
		SecurityAlertEmailTemplate,
		SecurityAlertEmailPropsSchema,
	),
	"two-factor-enabled": registerTemplate(
		"two-factor-enabled",
		"2FA Enabled",
		"Sent when a user enables authenticator-based 2FA.",
		TwoFactorEnabledEmailTemplate,
		TwoFactorStatusEmailPropsSchema,
	),
	"two-factor-disabled": registerTemplate(
		"two-factor-disabled",
		"2FA Disabled",
		"Sent when a user disables authenticator-based 2FA.",
		TwoFactorDisabledEmailTemplate,
		TwoFactorStatusEmailPropsSchema,
	),
	"login-verification": registerTemplate(
		"login-verification",
		"Login Verification",
		"OTP sent when signing in from an unrecognized device.",
		LoginVerificationEmailTemplate,
		LoginVerificationEmailPropsSchema,
	),
	"admin-alert": registerTemplate(
		"admin-alert",
		"Admin Alert",
		"Ops alert for admins (webhook failure, quota breach, …).",
		AdminAlertEmailTemplate,
		AdminAlertEmailPropsSchema,
	),
	"api-key-created": registerTemplate(
		"api-key-created",
		"API Key Created",
		"Confirms a new API key was created (never contains the secret).",
		ApiKeyCreatedEmailTemplate,
		ApiKeyCreatedEmailPropsSchema,
	),
	"reward-claim-otp": registerTemplate(
		"reward-claim-otp",
		"Reward Claim OTP",
		"6-digit claim code sent by email when SMS is unavailable.",
		RewardClaimOtpEmailTemplate,
		RewardClaimOtpEmailPropsSchema,
	),
	"referrer-reward-credited": registerTemplate(
		"referrer-reward-credited",
		"Referrer Reward Credited",
		"Sent when a referee redeems and the referrer earns R′.",
		ReferrerRewardCreditedEmailTemplate,
		ReferrerRewardCreditedEmailPropsSchema,
	),
	"merchant-invite": registerTemplate(
		"merchant-invite",
		"Merchant Invite",
		"Onboarding invite sent when an admin creates a merchant invite.",
		MerchantInviteEmailTemplate,
		MerchantInviteEmailPropsSchema,
	),
	"team-member-invite": registerTemplate(
		"team-member-invite",
		"Team Member Invite",
		"Invitation sent when an organization owner or admin invites a colleague.",
		TeamMemberInviteEmailTemplate,
		TeamMemberInviteEmailPropsSchema,
	),
};

/** Static metadata list for the admin preview index. */
export function listTemplateMeta(): EmailTemplateMeta[] {
	return Object.values(EMAIL_TEMPLATE_REGISTRY).map((entry: EmailTemplateEntry): EmailTemplateMeta =>
		EmailTemplateMetaSchema.parse({
			key: entry.key,
			label: entry.label,
			description: entry.description,
			sampleTo: entry.sampleTo,
			sampleSubject: entry.sampleSubject,
		}),
	);
}

/**
 * Build a preview payload from a concrete template instance (custom props).
 */
export function buildEmailPreviewFromTemplate(
	meta: Pick<EmailTemplateEntry, "key" | "label" | "description">,
	template: BaseEmailTemplate<BaseEmailProps>,
	context: EmailRenderContext,
	to: string,
): EmailPreview {
	const props: Record<string, string | number | boolean | null> = {};
	for (const [propKey, value] of Object.entries(template.props)) {
		const parsed = EmailPreviewPropValueSchema.safeParse(value);
		if (parsed.success) {
			props[propKey] = parsed.data;
		}
	}
	return EmailPreviewSchema.parse({
		key: meta.key,
		label: meta.label,
		description: meta.description,
		subject: template.subject,
		to,
		previewText: template.getPreviewText(context),
		html: template.renderHtml(context),
		text: template.renderText(context),
		props,
	});
}

/**
 * Build the preview payload for one template key.
 * Throws when the key is unknown — controllers map that to a 404.
 */
export function buildEmailPreview(key: EmailTemplateKey, context: EmailRenderContext): EmailPreview {
	const entry: EmailTemplateEntry | undefined = Object.values(EMAIL_TEMPLATE_REGISTRY).find((candidate: EmailTemplateEntry): boolean => candidate.key === key);
	if (entry === undefined) {
		throw new Error(`Unknown email template key: ${key}`);
	}
	const template: BaseEmailTemplate<BaseEmailProps> = entry.build();
	return buildEmailPreviewFromTemplate(entry, template, context, entry.sampleTo);
}
