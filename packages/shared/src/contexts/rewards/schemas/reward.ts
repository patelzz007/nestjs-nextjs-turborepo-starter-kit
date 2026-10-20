import { z } from "zod";

import { LIST_SLOT_INDEX } from "../../../lib/named-list-index";
import { BaseResponseSchema, type EpochMs, EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";
import { JsonObjectSchema } from "../../../schemas/runtime/json";
import { ImageSourceSchema } from "../../files/schemas/storage";
import { OrganizationLocationFilterSchema } from "../../organizations/schemas/location-filter";
import { type OrganizationLocationScopeType, OrganizationLocationScopeTypeSchema } from "../../organizations/schemas/organization";
import { PilotCitySchema } from "../../organizations/schemas/organization-enums";
import {
	type RewardCategory,
	RewardCategorySchema,
	RewardKindSchema,
	type RewardRules,
	RewardRulesResponseSchema,
	RewardRulesSchema,
	RewardStatusSchema,
	RewardTypeSchema,
} from "./reward-enums";

// ── Rewards: the Reward aggregate's requests and responses (merchant CRUD, admin review, marketplace) ──

/** Page size the consumer / merchant reward lists have always used. */
export const REWARD_LIST_DEFAULT_LIMIT = 10;

/** `GET /rewards` (consumer marketplace) list query — see docs/technical/api/list-queries.md. */
export const rewardListQuery = defineListQuery({
	sortable: ["createdAt", "expiryDate", "title"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		category: listFilter.enumeration(RewardCategorySchema, { eq: true, in: true }),
		city: listFilter.enumeration(PilotCitySchema, { eq: true, in: true }),
		/** One merchant's live offers (e.g. "More from this merchant" on a reward page). */
		organizationId: listFilter.uuid({ eq: true }),
	},
	params: { search: ListSearchSchema },
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});

export const RewardListQuerySchema = rewardListQuery.schema;

export type RewardListQuery = z.output<typeof RewardListQuerySchema>;

export type RewardListSortField = (typeof rewardListQuery.sortable)[number];

/** `GET /admin/rewards/pending` list query — the moderation queue, oldest reward first. */
export const adminPendingRewardListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "asc" }],
	filter: {},
	params: {},
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});

export const AdminPendingRewardListQuerySchema = adminPendingRewardListQuery.schema;

export type AdminPendingRewardListQuery = z.output<typeof AdminPendingRewardListQuerySchema>;

export type AdminPendingRewardListSortField = (typeof adminPendingRewardListQuery.sortable)[number];

/** The store-availability fields a reward create payload and the reward form both carry. */
interface RewardLocationScopeValue {
	readonly locationScopeType?: OrganizationLocationScopeType | undefined;
	readonly locationIds?: readonly string[] | undefined;
}

/** Refinement shared by the API payload and the form: `SELECTED` availability needs at least one store. */
function refineLocationScope(value: RewardLocationScopeValue, ctx: z.RefinementCtx): void {
	if (value.locationScopeType === "SELECTED" && (value.locationIds === undefined || value.locationIds.length === 0)) {
		ctx.addIssue({
			code: "custom",
			message: "Select at least one store when limiting reward availability",
			path: ["locationIds"],
		});
	}
}

// Field rules shared by the create payload, the update payload and the reward form.
const RewardTitleSchema = z.string().min(1).max(200);

const RewardDescriptionSchema = z.string().min(1).max(5000);

const RewardValueSchema = z.number().nonnegative();

const RewardTermsSchema = z.string().max(5000);

const RewardQuantitySchema = z.number().int().min(1);

const RewardReferralPoolSchema = z.number().int().min(1);

/** How many images a reward may show (the first is its cover). */
export const MAX_REWARD_IMAGES = 10;

/**
 * The reward's images, in display order (the first is the cover): READY,
 * public `REWARD_IMAGE` files uploaded to the same organization
 * (`POST /files/upload-url`). One to {@link MAX_REWARD_IMAGES}, each once.
 */
const RewardImageFileIdsSchema = z
	.array(z.uuid({ error: "Upload the image again" }))
	.min(1, { error: "Add at least one image" })
	.max(MAX_REWARD_IMAGES, { error: `Add up to ${String(MAX_REWARD_IMAGES)} images` })
	.refine((fileIds: readonly string[]): boolean => new Set(fileIds).size === fileIds.length, { error: "Each image can be added once" });

export const MerchantCreateRewardSchema = z
	.object({
		title: RewardTitleSchema,
		description: RewardDescriptionSchema,
		rewardType: RewardTypeSchema,
		rewardValue: RewardValueSchema,
		termsConditions: RewardTermsSchema.optional(),
		category: RewardCategorySchema,
		imageFileIds: RewardImageFileIdsSchema,
		quantityTotal: RewardQuantitySchema,
		startDate: EpochMsSchema.optional(),
		expiryDate: EpochMsSchema,
		rules: RewardRulesSchema.optional(),
		referralsEnabled: z.boolean().optional().default(false),
		referralPoolTotal: RewardReferralPoolSchema.optional(),
		referrerRewardTitle: RewardTitleSchema.optional(),
		saveAsDraft: z.boolean().optional().default(true),
		locationScopeType: OrganizationLocationScopeTypeSchema.optional().default("ALL_LOCATIONS"),
		locationIds: z.array(z.uuid()).optional().default([]),
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
		refineLocationScope(value, ctx);
	});

export type MerchantCreateRewardInput = z.output<typeof MerchantCreateRewardSchema>;

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const MerchantRewardFormFieldsSchema = z
	.object({
		rewardType: RewardTypeSchema,
		title: RewardTitleSchema,
		description: RewardDescriptionSchema,
		imageFileIds: RewardImageFileIdsSchema,
		rewardValue: RewardValueSchema,
		minPurchase: z.number().nonnegative().optional(),
		termsConditions: RewardTermsSchema.optional(),
		startDate: z.string().regex(DATE_INPUT_PATTERN),
		expiryDate: z.string().regex(DATE_INPUT_PATTERN),
		quantityTotal: RewardQuantitySchema,
		maxClaimsPerUser: z.number().int().min(1).max(10),
		locationScopeType: OrganizationLocationScopeTypeSchema.optional(),
		locationIds: z.array(z.uuid()).optional(),
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
		refineLocationScope(value, ctx);
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
	if (segments.length < 3) {
		return EpochMsSchema.parse(Number.NaN);
	}
	const year = Number(segments[LIST_SLOT_INDEX.first]);
	const month = Number(segments[LIST_SLOT_INDEX.second]);
	const day = Number(segments[LIST_SLOT_INDEX.third]);
	return EpochMsSchema.parse(Date.UTC(year, month - 1, day));
}

export function epochMsToDateInput(epoch: EpochMs | null, fallback: string): string {
	if (epoch === null) {
		return fallback;
	}
	const date = new Date(epoch);
	const year = String(date.getUTCFullYear());
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
	const locationScopeType = form.locationScopeType ?? "ALL_LOCATIONS";
	const locationIds = form.locationIds ?? [];

	return {
		title: form.title,
		description: form.description,
		rewardType: form.rewardType,
		rewardValue: form.rewardValue,
		termsConditions: form.termsConditions,
		category,
		imageFileIds: form.imageFileIds,
		quantityTotal: form.quantityTotal,
		startDate: parseRewardDateInputToEpochMs(form.startDate),
		expiryDate: parseRewardDateInputToEpochMs(form.expiryDate),
		rules: mapRewardFormFieldsToRules(form),
		referralsEnabled: false,
		saveAsDraft: form.saveAsDraft,
		locationScopeType,
		locationIds: locationScopeType === "SELECTED" ? locationIds : [],
	};
}

export function mapMerchantUpdateRewardFormToInput(form: MerchantRewardFormValues): MerchantUpdateRewardInput {
	return {
		title: form.title,
		description: form.description,
		rewardType: form.rewardType,
		rewardValue: form.rewardValue,
		termsConditions: form.termsConditions ?? null,
		imageFileIds: form.imageFileIds,
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
		imageFileIds: reward.images.map((image) => image.fileId),
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
		title: RewardTitleSchema.optional(),
		description: RewardDescriptionSchema.optional(),
		rewardType: RewardTypeSchema.optional(),
		rewardValue: RewardValueSchema.optional(),
		termsConditions: RewardTermsSchema.nullable().optional(),
		imageFileIds: RewardImageFileIdsSchema.optional(),
		quantityTotal: RewardQuantitySchema.optional(),
		startDate: EpochMsSchema.nullable().optional(),
		expiryDate: EpochMsSchema.optional(),
		referralsEnabled: z.boolean().optional(),
		referralPoolTotal: RewardReferralPoolSchema.optional(),
		referrerRewardTitle: RewardTitleSchema.optional(),
		rules: RewardRulesSchema.optional(),
	})
	.strict();

export type MerchantUpdateRewardInput = z.output<typeof MerchantUpdateRewardSchema>;

export const MerchantUpdateRewardPathInputSchema = MerchantUpdateRewardSchema.extend({
	rewardId: z.uuid(),
}).strict();

export type MerchantUpdateRewardPathInput = z.output<typeof MerchantUpdateRewardPathInputSchema>;

/**
 * `GET /orgs/:orgSlug/rewards` list query — the organization's rewards newest first; `filter[status][in]`
 * picks a catalog tab. `locationId` is an authorization SCOPE (checked against the member's stores).
 */
export const merchantRewardListQuery = defineListQuery({
	sortable: ["createdAt", "expiryDate", "title"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(RewardStatusSchema, { eq: true, in: true }),
	},
	params: OrganizationLocationFilterSchema.shape,
});

export const MerchantRewardListQuerySchema = merchantRewardListQuery.schema;

export type MerchantRewardListQuery = z.output<typeof MerchantRewardListQuerySchema>;

export type MerchantRewardListSortField = (typeof merchantRewardListQuery.sortable)[number];

/** `GET /orgs/:orgSlug/rewards/summary` query — the same store scope as the list. */
export const MerchantRewardSummaryQuerySchema = OrganizationLocationFilterSchema;

export type MerchantRewardSummaryQuery = z.output<typeof MerchantRewardSummaryQuerySchema>;

/**
 * `GET /orgs/:orgSlug/rewards/summary` — figures over EVERY reward in the store scope (every page of the
 * list): how many rewards are in each status, and the units still claimable across them.
 */
export const MerchantRewardSummarySchema = z.object({
	countsByStatus: z.record(RewardStatusSchema, z.number().int().nonnegative()),
	unitsRemaining: z.number().int().nonnegative(),
});

export type MerchantRewardSummary = z.output<typeof MerchantRewardSummarySchema>;

/** Longest rejection note an admin can send back to the merchant (fits the notification and audit rows comfortably). */
export const REWARD_REJECTION_REASON_MAX_LENGTH = 2000;

/** Rejecting a reward always tells the merchant why: a trimmed, non-empty reason is required (decision #74). */
export const AdminRejectRewardSchema = z
	.object({
		reason: z.string().trim().min(1, "Give the merchant a reason for the rejection.").max(REWARD_REJECTION_REASON_MAX_LENGTH),
	})
	.strict();

export type AdminRejectRewardInput = z.output<typeof AdminRejectRewardSchema>;

export const AdminRejectRewardPathInputSchema = AdminRejectRewardSchema.extend({
	rewardId: z.uuid(),
}).strict();

export type AdminRejectRewardPathInput = z.output<typeof AdminRejectRewardPathInputSchema>;

/** One reward, as the admin moderation detail route names it (`/admin/rewards/:rewardId`). */
export const AdminRewardPathInputSchema = z
	.object({
		rewardId: z.uuid(),
	})
	.strict();

export type AdminRewardPathInput = z.output<typeof AdminRewardPathInputSchema>;

/** One image of a reward, as the admin download route names it (`/admin/rewards/:rewardId/images/:fileId/download`). */
export const AdminRewardImagePathInputSchema = z
	.object({
		rewardId: z.uuid(),
		fileId: z.uuid(),
	})
	.strict();

export type AdminRewardImagePathInput = z.output<typeof AdminRewardImagePathInputSchema>;

/**
 * A short-lived signed URL that downloads a reward image's original upload
 * (16:9 at 4K) as an attachment named `fileName`.
 */
export const AdminRewardImageDownloadResponseSchema = z.object({
	fileId: z.uuid(),
	fileName: z.string().min(1),
	downloadUrl: z.string().min(1),
	expiresAt: EpochMsSchema,
});

export type AdminRewardImageDownloadResponse = z.output<typeof AdminRewardImageDownloadResponseSchema>;

/** A reward whose images the admin archive route downloads together (`/admin/rewards/:rewardId/images/archive`). */
export const AdminRewardImagesArchivePathInputSchema = z
	.object({
		rewardId: z.uuid(),
	})
	.strict();

export type AdminRewardImagesArchivePathInput = z.output<typeof AdminRewardImagesArchivePathInputSchema>;

/** The media type of a reward's image archive: one ZIP of the original uploads, in display order. */
export const REWARD_IMAGES_ARCHIVE_CONTENT_TYPE = "application/zip";

/** An http(s) URL — image URLs are rendered straight into `<img src>` / `srcset`. */
const ImageUrlSchema = ImageSourceSchema.shape.url;

/** One rendition of a reward image, for `srcset`: its width in pixels and URL (the shared image source). */
export const RewardImageSourceSchema = ImageSourceSchema;

export type RewardImageSource = z.output<typeof RewardImageSourceSchema>;

/**
 * One image of a reward: the 16:9 original's size, its renditions from
 * smallest to largest (render with `srcset`/`sizes` so each screen downloads
 * what it needs), and `url`, the largest rendition, for plain `<img src>`.
 */
export const RewardImageResponseSchema = z.object({
	fileId: z.uuid(),
	url: ImageUrlSchema,
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	sources: z.array(RewardImageSourceSchema).min(1),
});

export type RewardImageResponse = z.output<typeof RewardImageResponseSchema>;

export const RewardResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	organizationId: z.uuid(),
	organizationName: z.string().optional(),
	/**
	 * Public URL of the merchant's logo (the organization's READY `LOGO` asset),
	 * or `null` when none is uploaded — clients then show a name monogram.
	 * http(s) only: it is rendered straight into an `<img src>`.
	 */
	organizationLogoUrl: z.url({ protocol: /^https?$/ }).nullable(),
	/** The logo's served sizes, smallest first, for `srcset` (empty without a logo, or for one uploaded before logos had renditions). */
	organizationLogoSources: z.array(ImageSourceSchema),
	title: z.string(),
	description: z.string(),
	rewardType: RewardTypeSchema,
	rewardValue: z.number().int().nonnegative(),
	termsConditions: z.string().nullable(),
	rewardKind: RewardKindSchema,
	category: z.string(),
	/**
	 * The reward's images in display order — the first is its cover. Always at
	 * least one: a reward is only saved with READY, published images, and an
	 * image in use cannot be deleted.
	 */
	images: z.array(RewardImageResponseSchema).min(1).max(MAX_REWARD_IMAGES),
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
	rules: RewardRulesResponseSchema.nullable(),
	shareUrl: z.url().optional(),
	locationScopeType: OrganizationLocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	locationNames: z.array(z.string()).optional(),
});

export type RewardResponse = z.output<typeof RewardResponseSchema>;

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
			"reward.approved",
			"reward.rejected",
			"reward.claim_expired",
		]),
		actorUserId: z.uuid().nullable(),
		organizationId: z.uuid().nullable(),
		metadata: JsonObjectSchema,
		durationMs: z.number().int().nonnegative().optional(),
	})
	.strict();

export type RewardPlatformEvent = z.output<typeof RewardPlatformEventSchema>;
