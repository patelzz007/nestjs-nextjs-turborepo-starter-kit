import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema, type EpochMs } from "../api/common";
import { PaginationSchema } from "../api/pagination";
import { MerchantCapabilitySchema } from "./merchant-capabilities";
import { JsonObjectSchema } from "../runtime/json";

// ── Enums (mirror Prisma — packages/shared cannot import @prisma/client) ───

export const PilotCitySchema = z.enum(["KUALA_LUMPUR", "MELAKA"]);
export type PilotCity = z.output<typeof PilotCitySchema>;

export const MerchantOrgStatusSchema = z.enum(["ONBOARDING", "ACTIVE", "SUSPENDED"]);
export type MerchantOrgStatus = z.output<typeof MerchantOrgStatusSchema>;

export const KybStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type KybStatus = z.output<typeof KybStatusSchema>;

export const MerchantMemberRoleSchema = z.enum(["OWNER", "CASHIER"]);
export type MerchantMemberRole = z.output<typeof MerchantMemberRoleSchema>;

export const RewardTypeSchema = z.enum(["DISCOUNT", "FREE_ITEM", "CASHBACK", "POINTS", "BOGO"]);
export type RewardType = z.output<typeof RewardTypeSchema>;

export const RewardStatusSchema = z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "EXPIRED", "DISABLED"]);
export type RewardStatus = z.output<typeof RewardStatusSchema>;

export const RewardKindSchema = z.enum(["CONSUMER", "REFERRER"]);
export type RewardKind = z.output<typeof RewardKindSchema>;

export const RewardClaimStatusSchema = z.enum(["PENDING", "REDEEMED", "EXPIRED"]);
export type RewardClaimStatus = z.output<typeof RewardClaimStatusSchema>;

export const RewardRedemptionMethodSchema = z.enum(["SCAN", "MANUAL"]);
export type RewardRedemptionMethod = z.output<typeof RewardRedemptionMethodSchema>;

export const RewardReferralStatusSchema = z.enum(["PENDING", "CREDITED", "BLOCKED"]);
export type RewardReferralStatus = z.output<typeof RewardReferralStatusSchema>;

export const RewardOtpPurposeSchema = z.enum(["CLAIM"]);
export type RewardOtpPurpose = z.output<typeof RewardOtpPurposeSchema>;

/** Stock placeholder image keys by category (Phase 1). */
export const RewardCategorySchema = z.enum(["cafe", "restaurant", "retail", "wellness", "entertainment", "food", "beverage"]);
export type RewardCategory = z.output<typeof RewardCategorySchema>;

export const RewardRulesSchema = z
	.object({
		minSpendMyr: z.number().nonnegative().optional(),
		maxUsePerUser: z.number().int().positive().optional(),
	})
	.strict();

export type RewardRules = z.output<typeof RewardRulesSchema>;

/** 8-char backup code: A–Z + 2–9, excludes 0/O/1/I. */
export const RewardBackupCodeSchema = z
	.string()
	.length(8)
	.regex(/^[A-HJ-NP-Z2-9]{8}$/, "Invalid backup code format");

export type RewardBackupCode = z.output<typeof RewardBackupCodeSchema>;

export const RewardTerminalIdHeaderSchema = z.string().min(1).max(100);

// ── Query schemas ──────────────────────────────────────────────────────────

export const RewardListQuerySchema = PaginationSchema.extend({
	search: z.string().max(200).optional(),
	category: RewardCategorySchema.optional(),
	city: PilotCitySchema.optional(),
	ref: z.string().max(64).optional(),
}).strict();

export type RewardListQuery = z.output<typeof RewardListQuerySchema>;

export const RewardClaimListQuerySchema = PaginationSchema.extend({
	status: RewardClaimStatusSchema.optional(),
}).strict();

export type RewardClaimListQuery = z.output<typeof RewardClaimListQuerySchema>;

export const MerchantRedemptionListQuerySchema = PaginationSchema.strict();

export type MerchantRedemptionListQuery = z.output<typeof MerchantRedemptionListQuerySchema>;

export const AdminMerchantListQuerySchema = PaginationSchema.extend({
	search: z.string().max(200).optional(),
	city: PilotCitySchema.optional(),
	kybStatus: KybStatusSchema.optional(),
	status: MerchantOrgStatusSchema.optional(),
}).strict();

export type AdminMerchantListQuery = z.output<typeof AdminMerchantListQuerySchema>;

export const RewardNotificationListQuerySchema = PaginationSchema.extend({
	unreadOnly: z.coerce.boolean().optional(),
}).strict();

export type RewardNotificationListQuery = z.output<typeof RewardNotificationListQuerySchema>;

// ── Consumer / legal ─────────────────────────────────────────────────────

export const AcceptRewardLegalSchema = z
	.object({
		termsVersion: z.string().min(1).max(32),
		privacyVersion: z.string().min(1).max(32),
	})
	.strict();

export type AcceptRewardLegalInput = z.output<typeof AcceptRewardLegalSchema>;

export const RequestClaimOtpSchema = z
	.object({
		rewardId: z.uuid(),
		phone: z.string().min(8).max(20),
	})
	.strict();

export type RequestClaimOtpInput = z.output<typeof RequestClaimOtpSchema>;

export const CreateRewardClaimSchema = z
	.object({
		rewardId: z.uuid(),
		phone: z.string().min(8).max(20),
		otp: z
			.string()
			.length(6)
			.regex(/^\d{6}$/),
		captchaToken: z.string().min(1).optional(),
	})
	.strict();

export type CreateRewardClaimInput = z.output<typeof CreateRewardClaimSchema>;

export const MarkRewardNotificationsReadSchema = z
	.object({
		notificationIds: z.array(z.uuid()).optional(),
		markAll: z.boolean().optional(),
	})
	.strict();

export type MarkRewardNotificationsReadInput = z.output<typeof MarkRewardNotificationsReadSchema>;

// ── Redemption (POS) ─────────────────────────────────────────────────────

export const RedemptionValidateSchema = z
	.object({
		token: z.string().min(16).max(512).optional(),
		backupCode: RewardBackupCodeSchema.optional(),
	})
	.refine((value) => value.token !== undefined || value.backupCode !== undefined, {
		message: "token or backupCode is required",
	})
	.strict();

export type RedemptionValidateInput = z.output<typeof RedemptionValidateSchema>;

export const RedemptionConfirmSchema = z
	.object({
		token: z.string().min(16).max(512).optional(),
		backupCode: RewardBackupCodeSchema.optional(),
		idempotencyKey: z.uuid(),
	})
	.refine((value) => value.token !== undefined || value.backupCode !== undefined, {
		message: "token or backupCode is required",
	})
	.strict();

export type RedemptionConfirmInput = z.output<typeof RedemptionConfirmSchema>;

// ── Merchant reward CRUD ─────────────────────────────────────────────────

export const MerchantCreateRewardSchema = z
	.object({
		title: z.string().min(1).max(200),
		description: z.string().min(1).max(5000),
		rewardType: RewardTypeSchema,
		rewardValue: z.number().nonnegative(),
		termsConditions: z.string().max(5000).optional(),
		category: RewardCategorySchema,
		quantityTotal: z.number().int().min(1),
		startDate: EpochMsSchema.optional(),
		expiryDate: EpochMsSchema,
		rules: RewardRulesSchema.optional(),
		referralsEnabled: z.boolean().optional().default(false),
		referralPoolTotal: z.number().int().min(1).optional(),
		referrerRewardTitle: z.string().min(1).max(200).optional(),
		saveAsDraft: z.boolean().optional().default(true),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.referralsEnabled && value.referralPoolTotal === undefined) {
			ctx.addIssue({
				code: "custom",
				message: "referralPoolTotal is required when referrals are enabled",
				path: ["referralPoolTotal"],
			});
		}
	});

export type MerchantCreateRewardInput = z.output<typeof MerchantCreateRewardSchema>;

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const MerchantRewardFormFieldsSchema = z
	.object({
		rewardType: RewardTypeSchema,
		title: z.string().min(1).max(200),
		description: z.string().min(1).max(5000),
		rewardValue: z.number().nonnegative(),
		minPurchase: z.number().nonnegative().optional(),
		termsConditions: z.string().max(5000).optional(),
		startDate: z.string().regex(DATE_INPUT_PATTERN),
		expiryDate: z.string().regex(DATE_INPUT_PATTERN),
		quantityTotal: z.number().int().min(1),
		maxClaimsPerUser: z.number().int().min(1).max(10),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.expiryDate < value.startDate) {
			ctx.addIssue({
				code: "custom",
				message: "Expiry date must be on or after the start date",
				path: ["expiryDate"],
			});
		}
	});

export type MerchantRewardFormValues = z.output<typeof MerchantRewardFormFieldsSchema>;

export const MerchantCreateRewardFormSchema = MerchantRewardFormFieldsSchema.extend({
	saveAsDraft: z.boolean(),
}).strict();

export type MerchantCreateRewardFormValues = z.output<typeof MerchantCreateRewardFormSchema>;

export const MerchantUpdateRewardFormSchema = MerchantRewardFormFieldsSchema;

export type MerchantUpdateRewardFormValues = z.output<typeof MerchantUpdateRewardFormSchema>;

export function parseRewardDateInputToEpochMs(dateInput: string): EpochMs {
	const segments = dateInput.split("-");
	const yearSegment = segments[0];
	const monthSegment = segments[1];
	const daySegment = segments[2];
	if (yearSegment === undefined || monthSegment === undefined || daySegment === undefined) {
		return EpochMsSchema.parse(Number.NaN);
	}
	const year = Number(yearSegment);
	const month = Number(monthSegment);
	const day = Number(daySegment);
	return EpochMsSchema.parse(Date.UTC(year, month - 1, day));
}

export function epochMsToDateInput(epoch: EpochMs | null, fallback: string): string {
	if (epoch === null) {
		return fallback;
	}
	const date = new Date(epoch);
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function mapRewardFormFieldsToRules(form: MerchantRewardFormValues): RewardRules {
	return {
		...(form.minPurchase !== undefined ? { minSpendMyr: form.minPurchase } : {}),
		maxUsePerUser: form.maxClaimsPerUser,
	};
}

export function mapMerchantCreateRewardFormToInput(form: MerchantCreateRewardFormValues, category: RewardCategory): MerchantCreateRewardInput {
	return {
		title: form.title,
		description: form.description,
		rewardType: form.rewardType,
		rewardValue: form.rewardValue,
		termsConditions: form.termsConditions,
		category,
		quantityTotal: form.quantityTotal,
		startDate: parseRewardDateInputToEpochMs(form.startDate),
		expiryDate: parseRewardDateInputToEpochMs(form.expiryDate),
		rules: mapRewardFormFieldsToRules(form),
		referralsEnabled: false,
		saveAsDraft: form.saveAsDraft,
	};
}

export function mapMerchantUpdateRewardFormToInput(form: MerchantRewardFormValues): MerchantUpdateRewardInput {
	return {
		title: form.title,
		description: form.description,
		rewardType: form.rewardType,
		rewardValue: form.rewardValue,
		termsConditions: form.termsConditions ?? null,
		quantityTotal: form.quantityTotal,
		startDate: parseRewardDateInputToEpochMs(form.startDate),
		expiryDate: parseRewardDateInputToEpochMs(form.expiryDate),
		rules: mapRewardFormFieldsToRules(form),
	};
}

export function mapRewardResponseToFormValues(reward: RewardResponse): MerchantRewardFormValues {
	const todayFallback = epochMsToDateInput(EpochMsSchema.parse(Date.now()), "1970-01-01");
	const rules = reward.rules;

	return {
		rewardType: reward.rewardType,
		title: reward.title,
		description: reward.description,
		rewardValue: reward.rewardValue,
		minPurchase: rules?.minSpendMyr,
		termsConditions: reward.termsConditions ?? undefined,
		startDate: epochMsToDateInput(reward.startDate, todayFallback),
		expiryDate: epochMsToDateInput(reward.expiryDate, todayFallback),
		quantityTotal: reward.quantityTotal,
		maxClaimsPerUser: rules?.maxUsePerUser ?? 1,
	};
}

export const MerchantUpdateRewardSchema = z
	.object({
		title: z.string().min(1).max(200).optional(),
		description: z.string().min(1).max(5000).optional(),
		rewardType: RewardTypeSchema.optional(),
		rewardValue: z.number().nonnegative().optional(),
		termsConditions: z.string().max(5000).nullable().optional(),
		quantityTotal: z.number().int().min(1).optional(),
		startDate: EpochMsSchema.nullable().optional(),
		expiryDate: EpochMsSchema.optional(),
		referralsEnabled: z.boolean().optional(),
		referralPoolTotal: z.number().int().min(1).optional(),
		referrerRewardTitle: z.string().min(1).max(200).optional(),
		rules: RewardRulesSchema.optional(),
	})
	.strict();

export type MerchantUpdateRewardInput = z.output<typeof MerchantUpdateRewardSchema>;

export const MerchantUpdateRewardPathInputSchema = MerchantUpdateRewardSchema.extend({
	rewardId: z.uuid(),
}).strict();

export type MerchantUpdateRewardPathInput = z.output<typeof MerchantUpdateRewardPathInputSchema>;

export const MerchantCreateApiKeySchema = z
	.object({
		name: z.string().min(1).max(100).optional(),
	})
	.strict();

export type MerchantCreateApiKeyInput = z.output<typeof MerchantCreateApiKeySchema>;

// ── Admin ──────────────────────────────────────────────────────────────────

export const AdminCreateMerchantInviteSchema = z
	.object({
		email: z.email().max(100),
		businessName: z.string().min(1).max(200),
		city: PilotCitySchema,
	})
	.strict();

export type AdminCreateMerchantInviteInput = z.output<typeof AdminCreateMerchantInviteSchema>;

export const AdminRejectRewardSchema = z
	.object({
		reason: z.string().max(2000).optional(),
	})
	.strict();

export type AdminRejectRewardInput = z.output<typeof AdminRejectRewardSchema>;

export const AdminRejectRewardPathInputSchema = AdminRejectRewardSchema.extend({
	rewardId: z.uuid(),
}).strict();

export type AdminRejectRewardPathInput = z.output<typeof AdminRejectRewardPathInputSchema>;

export const AdminKybUpdateSchema = z
	.object({
		kybStatus: KybStatusSchema,
		kybFields: JsonObjectSchema.optional(),
	})
	.strict();

export type AdminKybUpdateInput = z.output<typeof AdminKybUpdateSchema>;

export const AdminKybUpdatePathInputSchema = AdminKybUpdateSchema.extend({
	merchantOrgId: z.uuid(),
}).strict();

export type AdminKybUpdatePathInput = z.output<typeof AdminKybUpdatePathInputSchema>;

export const AdminMerchantInviteCreatedResponseSchema = z
	.object({
		inviteId: z.uuid(),
		inviteToken: z.string().min(1),
		expiresAt: EpochMsSchema,
	})
	.strict();

export type AdminMerchantInviteCreatedResponse = z.output<typeof AdminMerchantInviteCreatedResponseSchema>;

// ── Response schemas ───────────────────────────────────────────────────────

export const MerchantOrgResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	businessName: z.string(),
	legalName: z.string().nullable(),
	category: z.string(),
	addressText: z.string().nullable(),
	city: PilotCitySchema,
	kybStatus: KybStatusSchema,
	status: MerchantOrgStatusSchema,
	contactEmail: z.string(),
	contactPhone: z.string().nullable(),
	/** Populated on admin merchant directory responses when an owner member exists. */
	ownerUserId: z.uuid().nullable().optional(),
});

export type MerchantOrgResponse = z.output<typeof MerchantOrgResponseSchema>;

export const MerchantMembershipResponseSchema = z
	.object({
		merchantOrgId: z.uuid(),
		businessName: z.string(),
		city: PilotCitySchema,
		role: MerchantMemberRoleSchema,
		kybStatus: KybStatusSchema,
		status: MerchantOrgStatusSchema,
		/** Portal capabilities resolved from `merchant_role_capabilities` for this membership role. */
		capabilities: z.array(MerchantCapabilitySchema),
	})
	.strict();

export type MerchantMembershipResponse = z.output<typeof MerchantMembershipResponseSchema>;

export const RewardResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	merchantOrgId: z.uuid(),
	merchantName: z.string().optional(),
	title: z.string(),
	description: z.string(),
	rewardType: RewardTypeSchema,
	rewardValue: z.number().int().nonnegative(),
	termsConditions: z.string().nullable(),
	rewardKind: RewardKindSchema,
	category: z.string(),
	placeholderImageKey: z.string(),
	quantityTotal: z.number().int(),
	quantityRemaining: z.number().int(),
	quantityReserved: z.number().int(),
	startDate: EpochMsSchema.nullable(),
	expiryDate: EpochMsSchema,
	status: RewardStatusSchema,
	claimCount: z.number().int(),
	redemptionCount: z.number().int(),
	referralsEnabled: z.boolean(),
	referralPoolTotal: z.number().int().nullable(),
	referralPoolRemaining: z.number().int().nullable(),
	referrerRewardId: z.uuid().nullable(),
	rules: RewardRulesSchema.nullable(),
	shareUrl: z.url().optional(),
});

export type RewardResponse = z.output<typeof RewardResponseSchema>;

export const RewardClaimResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	rewardId: z.uuid(),
	rewardTitle: z.string(),
	status: RewardClaimStatusSchema,
	claimedAt: EpochMsSchema,
	claimExpiresAt: EpochMsSchema,
	redeemedAt: EpochMsSchema.nullable(),
	isReferrerCredit: z.boolean(),
});

export type RewardClaimResponse = z.output<typeof RewardClaimResponseSchema>;

export const RewardClaimCreatedResponseSchema = z
	.object({
		claim: RewardClaimResponseSchema,
		qrDeepLink: z.string(),
		backupCode: RewardBackupCodeSchema,
	})
	.strict();

export type RewardClaimCreatedResponse = z.output<typeof RewardClaimCreatedResponseSchema>;

export const RewardClaimQrResponseSchema = z
	.object({
		claimId: z.uuid(),
		qrPayload: z.string(),
		backupCode: RewardBackupCodeSchema,
		claimExpiresAt: EpochMsSchema,
		backupLockedUntil: EpochMsSchema.nullable(),
	})
	.strict();

export type RewardClaimQrResponse = z.output<typeof RewardClaimQrResponseSchema>;

export const RewardNotificationResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	type: z.string(),
	title: z.string(),
	body: z.string(),
	readAt: EpochMsSchema.nullable(),
	metadata: JsonObjectSchema.nullable(),
});

export type RewardNotificationResponse = z.output<typeof RewardNotificationResponseSchema>;

export const RedemptionPreviewResponseSchema = z
	.object({
		claimId: z.uuid(),
		rewardTitle: z.string(),
		rewardType: RewardTypeSchema,
		claimExpiresAt: EpochMsSchema,
		valid: z.boolean(),
	})
	.strict();

export type RedemptionPreviewResponse = z.output<typeof RedemptionPreviewResponseSchema>;

export const RedemptionConfirmedResponseSchema = z
	.object({
		redemptionId: z.uuid(),
		claimId: z.uuid(),
		redeemedAt: EpochMsSchema,
		idempotencyKey: z.uuid(),
	})
	.strict();

export type RedemptionConfirmedResponse = z.output<typeof RedemptionConfirmedResponseSchema>;

export const MerchantApiKeySummarySchema = BaseResponseSchema.extend({
	id: z.uuid(),
	name: z.string(),
	revokedAt: EpochMsSchema.nullable(),
});

export type MerchantApiKeySummary = z.output<typeof MerchantApiKeySummarySchema>;

export const MerchantApiKeyCreatedSchema = z
	.object({
		id: z.uuid(),
		apiKey: z.string(),
		name: z.string(),
	})
	.strict();

export type MerchantApiKeyCreated = z.output<typeof MerchantApiKeyCreatedSchema>;

export const MerchantRedemptionListItemSchema = z
	.object({
		redemptionId: z.uuid(),
		rewardTitle: z.string(),
		redeemedAt: EpochMsSchema,
		terminalId: z.string(),
		redemptionMethod: RewardRedemptionMethodSchema,
	})
	.strict();

export type MerchantRedemptionListItem = z.output<typeof MerchantRedemptionListItemSchema>;

// ── Domain events (Phase 1 logging) ────────────────────────────────────────

export const RewardPlatformEventSchema = z
	.object({
		event: z.enum([
			"user.claim_reward",
			"user.redeem_reward",
			"merchant.scan_qr",
			"merchant.redeem_reward",
			"referral.credited",
			"referral.blocked",
			"reward.auto_published",
			"reward.claim_expired",
		]),
		actorUserId: z.uuid().nullable(),
		merchantOrgId: z.uuid().nullable(),
		metadata: JsonObjectSchema,
		durationMs: z.number().int().nonnegative().optional(),
	})
	.strict();

export type RewardPlatformEvent = z.output<typeof RewardPlatformEventSchema>;
