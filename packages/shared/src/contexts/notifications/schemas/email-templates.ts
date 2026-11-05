import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";

export const EmailAddressSchema = z.email();

export type EmailAddress = z.output<typeof EmailAddressSchema>;

/** Base props every email template accepts. */
export const BaseEmailPropsSchema = z
	.object({
		to: z.email(),
		cc: z.array(z.email()).optional(),
		bcc: z.array(z.email()).optional(),
		replyTo: z.email().optional(),
	})
	.strict();

export type BaseEmailProps = z.output<typeof BaseEmailPropsSchema>;

/** Brand color family for the email shell. */
export const EmailAccentSchema = z.enum(["green", "indigo", "red", "amber", "sky"]);

export type EmailAccent = z.output<typeof EmailAccentSchema>;

/** CTA button config — label + absolute URL. */
export const CtaConfigSchema = z
	.object({
		label: z.string().min(1),
		href: z.url(),
	})
	.strict();

export type CtaConfig = z.output<typeof CtaConfigSchema>;

/** Static branding/config injected at render time. */
export const EmailRenderContextSchema = z
	.object({
		appName: z.string().min(1),
		appUrl: z.url(),
		supportEmail: z.email().optional(),
	})
	.strict();

export type EmailRenderContext = z.output<typeof EmailRenderContextSchema>;

export const VerificationEmailPropsSchema = BaseEmailPropsSchema.extend({
	verificationToken: z.string().min(1),
	expiresInHours: z.number().int().positive().default(24),
	/** Override `EmailRenderContext.appUrl` for client-specific verification links (web / merchant). */
	appUrl: z.url().optional(),
}).strict();

export type VerificationEmailProps = z.output<typeof VerificationEmailPropsSchema>;

export const PasswordResetEmailPropsSchema = BaseEmailPropsSchema.extend({
	resetToken: z.string().min(1),
	expiresInHours: z.number().int().positive().default(1),
	/** Override `EmailRenderContext.appUrl` for client-specific reset links (admin / merchant / web). */
	appUrl: z.url().optional(),
}).strict();

export type PasswordResetEmailProps = z.output<typeof PasswordResetEmailPropsSchema>;

export const PasswordChangedEmailPropsSchema = BaseEmailPropsSchema.extend({
	changedAt: EpochMsSchema,
}).strict();

export type PasswordChangedEmailProps = z.output<typeof PasswordChangedEmailPropsSchema>;

export const TwoFactorStatusEmailPropsSchema = BaseEmailPropsSchema.extend({
	changedAt: EpochMsSchema,
}).strict();

export type TwoFactorStatusEmailProps = z.output<typeof TwoFactorStatusEmailPropsSchema>;

/** A passkey was added to or removed from the account (ADR 080): which one, and when. */
export const PasskeyChangedEmailPropsSchema = BaseEmailPropsSchema.extend({
	passkeyName: z.string().min(1).max(64),
	changedAt: EpochMsSchema,
}).strict();

export type PasskeyChangedEmailProps = z.output<typeof PasskeyChangedEmailPropsSchema>;

export const LoginVerificationEmailPropsSchema = BaseEmailPropsSchema.extend({
	verificationCode: z.string().length(6),
	expiresInMinutes: z.number().int().positive().default(10),
	deviceInfo: z.string().min(1),
	ipAddress: z.string().min(1),
}).strict();

export type LoginVerificationEmailProps = z.output<typeof LoginVerificationEmailPropsSchema>;

export const AccountLockedEmailPropsSchema = BaseEmailPropsSchema.extend({
	lockedUntil: EpochMsSchema,
}).strict();

export type AccountLockedEmailProps = z.output<typeof AccountLockedEmailPropsSchema>;

export const WelcomeEmailPropsSchema = BaseEmailPropsSchema.extend({
	fullName: z.string().min(1),
}).strict();

export type WelcomeEmailProps = z.output<typeof WelcomeEmailPropsSchema>;

export const SecurityAlertEmailPropsSchema = BaseEmailPropsSchema.extend({
	deviceLabel: z.string().min(1).optional(),
	location: z.string().min(1).optional(),
	signedInAt: EpochMsSchema.optional(),
}).strict();

export type SecurityAlertEmailProps = z.output<typeof SecurityAlertEmailPropsSchema>;

export const AdminAlertEmailPropsSchema = BaseEmailPropsSchema.extend({
	title: z.string().min(1),
	message: z.string().min(1),
	/**
	 * Optional call to action. Absolute URL: the render context's `appUrl` is
	 * the consumer web app, so the caller (who knows the audience) supplies it.
	 */
	action: z
		.object({ label: z.string().min(1), url: z.url() })
		.strict()
		.optional(),
}).strict();

export type AdminAlertEmailProps = z.output<typeof AdminAlertEmailPropsSchema>;

export const ApiKeyCreatedEmailPropsSchema = BaseEmailPropsSchema.extend({
	keyName: z.string().min(1),
	createdAt: EpochMsSchema,
	/** Absolute URL of the tenant's API-keys page (merchant app, tenant-scoped). */
	manageKeysUrl: z.url(),
}).strict();

export type ApiKeyCreatedEmailProps = z.output<typeof ApiKeyCreatedEmailPropsSchema>;

/** Claim OTP — email fallback when SMS (Twilio) is not configured. */
export const RewardClaimOtpEmailPropsSchema = BaseEmailPropsSchema.extend({
	rewardTitle: z.string().min(1),
	otpCode: z
		.string()
		.length(6)
		.regex(/^\d{6}$/),
	expiresInMinutes: z.number().int().positive().default(5),
}).strict();

export type RewardClaimOtpEmailProps = z.output<typeof RewardClaimOtpEmailPropsSchema>;

export const ReferrerRewardCreditedEmailPropsSchema = BaseEmailPropsSchema.extend({
	rewardTitle: z.string().min(1),
	claimExpiresDays: z.number().int().positive().default(30),
}).strict();

export type ReferrerRewardCreditedEmailProps = z.output<typeof ReferrerRewardCreditedEmailPropsSchema>;

export const MerchantInviteEmailPropsSchema = BaseEmailPropsSchema.extend({
	businessName: z.string().min(1),
	cityLabel: z.string().min(1),
	inviteUrl: z.url(),
	expiresInDays: z.number().int().positive().default(7),
}).strict();

export type MerchantInviteEmailProps = z.output<typeof MerchantInviteEmailPropsSchema>;

export const TeamMemberInviteEmailPropsSchema = BaseEmailPropsSchema.extend({
	tenantName: z.string().min(1),
	roleLabel: z.string().min(1),
	locationSummary: z.string().min(1),
	inviteUrl: z.url(),
	expiresInDays: z.number().int().positive().default(7),
}).strict();

export type TeamMemberInviteEmailProps = z.output<typeof TeamMemberInviteEmailPropsSchema>;

// ── Notifications (ADR 070) and broadcasts (ADR 073) ─────────────────────

/** One catalog notification rendered as an email (copy comes from the type's renderer). */
export const NotificationEmailPropsSchema = BaseEmailPropsSchema.extend({
	subject: z.string().min(1).max(200),
	eyebrow: z.string().min(1).max(80),
	heading: z.string().min(1).max(200),
	paragraphs: z.array(z.string().min(1).max(4_000)).min(1).max(20),
	actionLabel: z.string().min(1).max(60).optional(),
	actionUrl: z.url().optional(),
	/** The web unsubscribe page (the footer link); absent for mandatory (security) emails. */
	unsubscribeUrl: z.url().optional(),
	/** The RFC 8058 one-click endpoint (the `List-Unsubscribe` header); set together with `unsubscribeUrl`. */
	oneClickUnsubscribeUrl: z.url().optional(),
}).strict();
export type NotificationEmailProps = z.output<typeof NotificationEmailPropsSchema>;

/** The daily or weekly digest: parallel lists (job props hold only scalars and string lists). */
export const NotificationDigestEmailPropsSchema = BaseEmailPropsSchema.extend({
	period: z.enum(["DAILY", "WEEKLY"]),
	itemTitles: z.array(z.string().min(1).max(200)).min(1).max(100),
	itemBodies: z.array(z.string().max(4_000)).min(1).max(100),
	itemLinks: z.array(z.string().max(500)).min(1).max(100),
	unsubscribeUrl: z.url().optional(),
	oneClickUnsubscribeUrl: z.url().optional(),
})
	.strict()
	.refine((props): boolean => props.itemTitles.length === props.itemBodies.length && props.itemTitles.length === props.itemLinks.length, {
		message: "Each digest item has a title, a body and a link",
	});
export type NotificationDigestEmailProps = z.output<typeof NotificationDigestEmailPropsSchema>;

/** A broadcast email: its body is the server's own rendering of the validated rich text (never sender HTML). */
export const BroadcastEmailPropsSchema = BaseEmailPropsSchema.extend({
	senderName: z.string().min(1).max(200),
	title: z.string().min(1).max(200),
	bodyHtml: z.string().min(1).max(500_000),
	bodyText: z.string().min(1).max(100_000),
	unsubscribeUrl: z.url(),
	oneClickUnsubscribeUrl: z.url(),
}).strict();
export type BroadcastEmailProps = z.output<typeof BroadcastEmailPropsSchema>;
