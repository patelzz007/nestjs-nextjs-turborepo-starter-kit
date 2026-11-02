import { z } from "zod";

import { LIST_SLOT_INDEX } from "../../../lib/named-list-index";
import { BaseResponseSchema, type EpochMs, EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";
import { JsonObjectSchema } from "../../../schemas/runtime/json";
import { ImageSourceSchema } from "../../files/schemas/storage";
import { LocationFilterSchema } from "../../tenancy/schemas/location-filter";
import { type LocationScopeType, LocationScopeTypeSchema } from "../../tenancy/schemas/tenant";
import { PilotCitySchema } from "../../tenancy/schemas/tenant-enums";
import {
	type RewardAudienceType,
	RewardAudienceTypeSchema,
	type RewardCategory,
	RewardCategorySchema,
	RewardKindSchema,
	type RewardRules,
	RewardRulesResponseSchema,
	RewardRulesSchema,
	RewardStatusSchema,
	RewardTypeSchema,
} from "./reward-enums";
import { refineRewardFreeItem, rewardTypeGivesFreeItem, RewardFreeItemResponseSchema, RewardFreeItemSchema } from "./reward-free-item";

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
		tenantId: listFilter.uuid({ eq: true }),
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
	readonly locationScopeType?: LocationScopeType | undefined;
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

/** How many customers one reward can be given to (more is a broadcast-sized audience: give it to everyone). */
export const REWARD_MAX_AUDIENCE_CUSTOMERS = 500;

/** The customers a reward is given to: the tenant's own customers, each once. */
const RewardAudienceCustomerIdsSchema = z
	.array(z.uuid())
	.max(REWARD_MAX_AUDIENCE_CUSTOMERS, { error: `Give a reward to up to ${String(REWARD_MAX_AUDIENCE_CUSTOMERS)} customers, or to everyone` })
	.refine((userIds: readonly string[]): boolean => new Set(userIds).size === userIds.length, { error: "Each customer can be added once" });

/** The audience fields a reward payload and the reward form carry. */
interface RewardAudienceValue {
	readonly audienceType?: RewardAudienceType | undefined;
	readonly audienceCustomerIds?: readonly string[] | undefined;
	readonly referralsEnabled?: boolean | undefined;
}

/**
 * Refinement shared by the payloads and the form: a reward given to chosen customers names at least one,
 * names customers only when it is for chosen customers, and has no referrals (referrals bring in new
 * people, which a private reward is not for).
 */
function refineRewardAudience(value: RewardAudienceValue, ctx: z.RefinementCtx): void {
	const customerCount = value.audienceCustomerIds?.length ?? 0;
	if (value.audienceType === "SELECTED_CUSTOMERS" && customerCount === 0) {
		ctx.addIssue({ code: "custom", message: "Choose at least one customer, or give the reward to everyone", path: ["audienceCustomerIds"] });
	}
	if (value.audienceType !== "SELECTED_CUSTOMERS" && customerCount > 0) {
		ctx.addIssue({ code: "custom", message: "Customers are chosen only for a reward given to chosen customers", path: ["audienceCustomerIds"] });
	}
	if (value.audienceType === "SELECTED_CUSTOMERS" && value.referralsEnabled === true) {
		ctx.addIssue({ code: "custom", message: "A reward for chosen customers cannot have referrals", path: ["referralsEnabled"] });
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
 * public `REWARD_IMAGE` files uploaded to the same tenant
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
		/** Required for `FREE_ITEM` and `BOGO` (the item given), absent for every other type. */
		freeItem: RewardFreeItemSchema.optional(),
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
		locationScopeType: LocationScopeTypeSchema.optional().default("ALL_LOCATIONS"),
		locationIds: z.array(z.uuid()).optional().default([]),
		/** Nothing chosen: the reward is for everyone. */
		audienceType: RewardAudienceTypeSchema.optional().default("EVERYONE"),
		audienceCustomerIds: RewardAudienceCustomerIdsSchema.optional().default([]),
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
		refineRewardAudience(value, ctx);
		refineRewardFreeItem(value, ctx);
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
		/** Carried only while the type gives an item (the editor drops it for any other type). */
		freeItem: RewardFreeItemSchema.optional(),
		minPurchase: z.number().nonnegative().optional(),
		termsConditions: RewardTermsSchema.optional(),
		startDate: z.string().regex(DATE_INPUT_PATTERN),
		expiryDate: z.string().regex(DATE_INPUT_PATTERN),
		quantityTotal: RewardQuantitySchema,
		maxClaimsPerUser: z.number().int().min(1).max(10),
		locationScopeType: LocationScopeTypeSchema.optional(),
		locationIds: z.array(z.uuid()).optional(),
		audienceType: RewardAudienceTypeSchema.optional(),
		audienceCustomerIds: RewardAudienceCustomerIdsSchema.optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		refineRewardAudience(value, ctx);
		refineRewardFreeItem(value, ctx);
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
	const audience = rewardAudienceOfForm(form);

	return {
		title: form.title,
		description: form.description,
		rewardType: form.rewardType,
		rewardValue: form.rewardValue,
		...(rewardTypeGivesFreeItem(form.rewardType) && form.freeItem !== undefined ? { freeItem: form.freeItem } : {}),
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
		audienceType: audience.audienceType,
		audienceCustomerIds: audience.audienceCustomerIds,
	};
}

/** The form's audience as the API takes it: nothing chosen means everyone. */
function rewardAudienceOfForm(form: MerchantRewardFormValues): { readonly audienceType: RewardAudienceType; readonly audienceCustomerIds: string[] } {
	const audienceCustomerIds = form.audienceCustomerIds ?? [];
	return form.audienceType === "SELECTED_CUSTOMERS" && audienceCustomerIds.length > 0
		? { audienceType: "SELECTED_CUSTOMERS", audienceCustomerIds: [...audienceCustomerIds] }
		: { audienceType: "EVERYONE", audienceCustomerIds: [] };
}

export function mapMerchantUpdateRewardFormToInput(form: MerchantRewardFormValues): MerchantUpdateRewardInput {
	return {
		title: form.title,
		description: form.description,
		rewardType: form.rewardType,
		rewardValue: form.rewardValue,
		freeItem: rewardTypeGivesFreeItem(form.rewardType) ? (form.freeItem ?? null) : null,
		termsConditions: form.termsConditions ?? null,
		imageFileIds: form.imageFileIds,
		quantityTotal: form.quantityTotal,
		startDate: parseRewardDateInputToEpochMs(form.startDate),
		expiryDate: parseRewardDateInputToEpochMs(form.expiryDate),
		rules: mapRewardFormFieldsToRules(form),
		...rewardAudienceOfForm(form),
	};
}

/** The reward as the editor loads it; `audienceCustomerIds` come from the reward's audience (`GET …/rewards/:rewardId/audience`). */
export function mapRewardResponseToFormValues(reward: RewardResponse, audienceCustomerIds: readonly string[] = []): MerchantRewardFormValues {
	const todayFallback = epochMsToDateInput(EpochMsSchema.parse(Date.now()), "1970-01-01");
	const rules = reward.rules;

	return {
		rewardType: reward.rewardType,
		title: reward.title,
		description: reward.description,
		imageFileIds: reward.images.map((image) => image.fileId),
		rewardValue: reward.rewardValue,
		...(reward.freeItem === null ? {} : { freeItem: { name: reward.freeItem.name, sku: reward.freeItem.sku } }),
		minPurchase: rules?.minSpendMyr,
		termsConditions: reward.termsConditions ?? undefined,
		startDate: epochMsToDateInput(reward.startDate, todayFallback),
		expiryDate: epochMsToDateInput(reward.expiryDate, todayFallback),
		quantityTotal: reward.quantityTotal,
		maxClaimsPerUser: rules?.maxUsePerUser ?? 1,
		audienceType: reward.audienceType,
		audienceCustomerIds: reward.audienceType === "SELECTED_CUSTOMERS" ? [...audienceCustomerIds] : [],
	};
}

export const MerchantUpdateRewardSchema = z
	.object({
		title: RewardTitleSchema.optional(),
		description: RewardDescriptionSchema.optional(),
		rewardType: RewardTypeSchema.optional(),
		rewardValue: RewardValueSchema.optional(),
		/** The item a `FREE_ITEM` / `BOGO` reward gives; null for any other type. Absent: unchanged (a type change away from an item type drops it). */
		freeItem: RewardFreeItemSchema.nullable().optional(),
		termsConditions: RewardTermsSchema.nullable().optional(),
		imageFileIds: RewardImageFileIdsSchema.optional(),
		quantityTotal: RewardQuantitySchema.optional(),
		startDate: EpochMsSchema.nullable().optional(),
		expiryDate: EpochMsSchema.optional(),
		referralsEnabled: z.boolean().optional(),
		referralPoolTotal: RewardReferralPoolSchema.optional(),
		referrerRewardTitle: RewardTitleSchema.optional(),
		rules: RewardRulesSchema.optional(),
		/** Sent together: who the reward is for from now on (customers removed keep the claims they made). */
		audienceType: RewardAudienceTypeSchema.optional(),
		audienceCustomerIds: RewardAudienceCustomerIdsSchema.optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.audienceCustomerIds !== undefined && value.audienceType === undefined) {
			ctx.addIssue({ code: "custom", message: "Send audienceType with audienceCustomerIds", path: ["audienceType"] });
		}
		refineRewardAudience(value, ctx);
		refineRewardFreeItem(value, ctx);
	});

export type MerchantUpdateRewardInput = z.output<typeof MerchantUpdateRewardSchema>;

export const MerchantUpdateRewardPathInputSchema = z.intersection(z.object({ rewardId: z.uuid() }).strict(), MerchantUpdateRewardSchema);

export type MerchantUpdateRewardPathInput = z.output<typeof MerchantUpdateRewardPathInputSchema>;

/**
 * `GET /tenants/:tenantSlug/rewards` list query — the tenant's rewards newest first; `filter[status][in]`
 * picks a catalog tab. `locationId` is an authorization SCOPE (checked against the member's stores).
 */
export const merchantRewardListQuery = defineListQuery({
	sortable: ["createdAt", "expiryDate", "title"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(RewardStatusSchema, { eq: true, in: true }),
	},
	params: LocationFilterSchema.shape,
});

export const MerchantRewardListQuerySchema = merchantRewardListQuery.schema;

export type MerchantRewardListQuery = z.output<typeof MerchantRewardListQuerySchema>;

export type MerchantRewardListSortField = (typeof merchantRewardListQuery.sortable)[number];

/** `GET /tenants/:tenantSlug/rewards/summary` query — the same store scope as the list. */
export const MerchantRewardSummaryQuerySchema = LocationFilterSchema;

export type MerchantRewardSummaryQuery = z.output<typeof MerchantRewardSummaryQuerySchema>;

/**
 * `GET /tenants/:tenantSlug/rewards/summary` — figures over EVERY reward in the store scope (every page of the
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
	tenantId: z.uuid(),
	tenantName: z.string().optional(),
	/**
	 * Public URL of the merchant's logo (the tenant's READY `LOGO` asset),
	 * or `null` when none is uploaded — clients then show a name monogram.
	 * http(s) only: it is rendered straight into an `<img src>`.
	 */
	tenantLogoUrl: z.url({ protocol: /^https?$/ }).nullable(),
	/** The logo's served sizes, smallest first, for `srcset` (empty without a logo, or for one uploaded before logos had renditions). */
	tenantLogoSources: z.array(ImageSourceSchema),
	title: z.string(),
	description: z.string(),
	rewardType: RewardTypeSchema,
	rewardValue: z.number().int().nonnegative(),
	/** The item a `FREE_ITEM` / `BOGO` reward gives (its name and the merchant's SKU); null for any other type. */
	freeItem: RewardFreeItemResponseSchema.nullable(),
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
	locationScopeType: LocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	locationNames: z.array(z.string()).optional(),
	/** `SELECTED_CUSTOMERS`: only the customers it was given to see and claim it (the list: `GET …/rewards/:rewardId/audience`, tenant only). */
	audienceType: RewardAudienceTypeSchema,
});

export type RewardResponse = z.output<typeof RewardResponseSchema>;

/** One of the tenant's customers as a merchant sees them: a name and a masked email, never the full address. */
export const RewardCustomerSchema = z.object({
	userId: z.uuid(),
	fullName: z.string(),
	maskedEmail: z.string().nullable(),
	lastClaimedAt: EpochMsSchema,
	claimCount: z.number().int().nonnegative(),
});
export type RewardCustomer = z.output<typeof RewardCustomerSchema>;

/** Who a reward is for (tenant only): everyone, or the customers it was given to. */
export const RewardAudienceResponseSchema = z.object({
	audienceType: RewardAudienceTypeSchema,
	customers: z.array(RewardCustomerSchema).max(REWARD_MAX_AUDIENCE_CUSTOMERS),
});
export type RewardAudienceResponse = z.output<typeof RewardAudienceResponseSchema>;

/** `GET /tenants/:tenantSlug/rewards/customers`: the tenant's customers, to give a reward to (search by name or email). */
export const rewardCustomerListQuery = defineListQuery({
	sortable: ["lastClaimedAt", "claimCount"],
	defaultSort: [{ field: "lastClaimedAt", direction: "desc" }],
	filter: { lastClaimedAt: listFilter.epochMs({ gte: true, lte: true }) },
	params: { search: ListSearchSchema },
	defaultLimit: 20,
});
export const RewardCustomerListQuerySchema = rewardCustomerListQuery.schema;
export type RewardCustomerListQuery = z.output<typeof RewardCustomerListQuerySchema>;

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
		tenantId: z.uuid().nullable(),
		metadata: JsonObjectSchema,
		durationMs: z.number().int().nonnegative().optional(),
	})
	.strict();

export type RewardPlatformEvent = z.output<typeof RewardPlatformEventSchema>;
