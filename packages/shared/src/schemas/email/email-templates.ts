import { z } from "zod";

import { EpochMsSchema } from "../api/common";

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
}).strict();

export type VerificationEmailProps = z.output<typeof VerificationEmailPropsSchema>;

export const PasswordResetEmailPropsSchema = BaseEmailPropsSchema.extend({
	resetToken: z.string().min(1),
	expiresInHours: z.number().int().positive().default(1),
}).strict();

export type PasswordResetEmailProps = z.output<typeof PasswordResetEmailPropsSchema>;

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
}).strict();

export type AdminAlertEmailProps = z.output<typeof AdminAlertEmailPropsSchema>;

export const ApiKeyCreatedEmailPropsSchema = BaseEmailPropsSchema.extend({
	keyName: z.string().min(1),
	createdAt: EpochMsSchema,
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
