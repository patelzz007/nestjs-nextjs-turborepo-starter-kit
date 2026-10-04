import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema, type EpochMs } from "../../api/common";
import { CanonicalEmailSchema } from "../../api/email-address";
import { defineListQuery, LIST_MAX_LIMIT, listFilter, ListSearchSchema } from "../../api/list-query";
import { OrganizationLocationFilterSchema } from "../organization/location-filter";
import { OrganizationLocationResponseSchema, OrganizationLocationScopeTypeSchema, OrganizationSlugSchema } from "../organization/organization";
import { JsonObjectSchema } from "../../runtime/json";
import {
	KybStatusSchema,
	MerchantOrgStatusSchema,
	PilotCitySchema,
	RewardBackupCodeSchema,
	RewardCategorySchema,
	type RewardCategory,
	RewardClaimStatusSchema,
	RewardKindSchema,
	RewardRedemptionMethodSchema,
	RewardRulesResponseSchema,
	RewardRulesSchema,
	type RewardRules,
	RewardStatusSchema,
	RewardTypeSchema,
} from "./rewards-enums";
import { MerchantKybDocumentRecordSchema } from "./rewards-kyb";

// ── Query schemas ──────────────────────────────────────────────────────────

/** Page size the consumer / merchant reward lists have always used. */
export const REWARD_LIST_DEFAULT_LIMIT = 10;

/** `GET /rewards` (consumer marketplace) list query — see docs/technical/api/list-queries.md. */
export const rewardListQuery = defineListQuery({
	sortable: ["createdAt", "expiryDate", "title"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		category: listFilter.enumeration(RewardCategorySchema, { eq: true, in: true }),
		city: listFilter.enumeration(PilotCitySchema, { eq: true, in: true }),
	},
	params: { search: ListSearchSchema },
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});
export const RewardListQuerySchema = rewardListQuery.schema;
export type RewardListQuery = z.output<typeof RewardListQuerySchema>;
export type RewardListSortField = (typeof rewardListQuery.sortable)[number];

/** `GET /claims` (the signed-in user's claims) list query. */
export const rewardClaimListQuery = defineListQuery({
	sortable: ["claimedAt", "createdAt"],
	defaultSort: [{ field: "claimedAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(RewardClaimStatusSchema, { eq: true, in: true }),
	},
	params: {},
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});
export const RewardClaimListQuerySchema = rewardClaimListQuery.schema;
export type RewardClaimListQuery = z.output<typeof RewardClaimListQuerySchema>;
export type RewardClaimListSortField = (typeof rewardClaimListQuery.sortable)[number];

/**
 * `GET /orgs/:orgSlug/redemptions` list query. `locationId` is an authorization SCOPE (checked against the member's stores), not a filter.
 * `filter[redeemedAt][gte]` / `[lt]` narrow to a time window — e.g. "today" in the viewer's time zone; the response's
 * `meta.total` is then the server-side count of that window (never a count of the rows on one page).
 */
export const merchantRedemptionListQuery = defineListQuery({
	sortable: ["redeemedAt"],
	defaultSort: [{ field: "redeemedAt", direction: "desc" }],
	filter: {
		redeemedAt: listFilter.epochMs({ gte: true, lt: true }),
	},
	params: OrganizationLocationFilterSchema.shape,
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});
export const MerchantRedemptionListQuerySchema = merchantRedemptionListQuery.schema;
export type MerchantRedemptionListQuery = z.output<typeof MerchantRedemptionListQuerySchema>;
export type MerchantRedemptionListSortField = (typeof merchantRedemptionListQuery.sortable)[number];

/** `GET /admin/merchants` list query. */
export const adminMerchantListQuery = defineListQuery({
	sortable: ["createdAt", "displayName"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		city: listFilter.enumeration(PilotCitySchema, { eq: true, in: true }),
		kybStatus: listFilter.enumeration(KybStatusSchema, { eq: true, in: true }),
		status: listFilter.enumeration(MerchantOrgStatusSchema, { eq: true, in: true }),
	},
	params: { search: ListSearchSchema },
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});
export const AdminMerchantListQuerySchema = adminMerchantListQuery.schema;
export type AdminMerchantListQuery = z.output<typeof AdminMerchantListQuerySchema>;
export type AdminMerchantListSortField = (typeof adminMerchantListQuery.sortable)[number];

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

/** `GET /rewards/notifications` list query — `filter[readAt][isNull]=true` lists unread notifications. */
export const rewardNotificationListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		readAt: listFilter.epochMs({ isNull: true, gte: true, lte: true }),
	},
	params: {},
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});
export const RewardNotificationListQuerySchema = rewardNotificationListQuery.schema;
export type RewardNotificationListQuery = z.output<typeof RewardNotificationListQuerySchema>;
export type RewardNotificationListSortField = (typeof rewardNotificationListQuery.sortable)[number];

// ── Consumer / legal ─────────────────────────────────────────────────────

export const AcceptRewardLegalSchema = z
	.object({
		termsVersion: z.string().min(1).max(32),
		privacyVersion: z.string().min(1).max(32),
	})
	.strict();

export type AcceptRewardLegalInput = z.output<typeof AcceptRewardLegalSchema>;

/** Claim checkout state for the signed-in user (legal acceptance + verified phone). */
export const RewardClaimCheckoutStatusSchema = z.object({
	hasAcceptedLegal: z.boolean(),
	termsVersion: z.string().nullable(),
	privacyVersion: z.string().nullable(),
	phone: z.string().nullable(),
	phoneVerified: z.boolean(),
});

export type RewardClaimCheckoutStatus = z.output<typeof RewardClaimCheckoutStatusSchema>;

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
			.regex(/^\d{6}$/)
			.optional(),
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

const redemptionCodeShape = {
	token: z.string().min(16).max(512).optional(),
	backupCode: RewardBackupCodeSchema.optional(),
};

/** Exactly one of the two: a code is either the scanned QR token or the backup code read out instead — never both, never neither. */
function hasExactlyOneRedemptionCode(value: { readonly token?: string | undefined; readonly backupCode?: string | undefined }): boolean {
	return (value.token !== undefined) !== (value.backupCode !== undefined);
}

const REDEMPTION_CODE_EXACTLY_ONE = { message: "Send exactly one of token or backupCode" };

/** One customer code scanned at the till: the QR token, or the 8-character backup code read out instead. */
export const RedemptionCodeSchema = z.object(redemptionCodeShape).strict().refine(hasExactlyOneRedemptionCode, REDEMPTION_CODE_EXACTLY_ONE);

export type RedemptionCode = z.output<typeof RedemptionCodeSchema>;

export const RedemptionValidateSchema = RedemptionCodeSchema;

export type RedemptionValidateInput = z.output<typeof RedemptionValidateSchema>;

/** Longest `X-Terminal-Id` (the device label a POS sends with every call). */
export const POS_TERMINAL_ID_MAX_LENGTH = 100;

/** `X-Terminal-Id` header: a printable device label such as `KL-REGISTER-01`. It identifies — never authenticates — the till. */
export const PosTerminalIdSchema = z
	.string()
	.min(1)
	.max(POS_TERMINAL_ID_MAX_LENGTH)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u, "Terminal id may contain letters, digits, '.', '_', ':' and '-'");

/** Currencies a POS bill may be settled in (ISO 4217). Amounts are always integer minor units (sen). */
export const SaleCurrencySchema = z.enum(["MYR"]);

export type SaleCurrency = z.output<typeof SaleCurrencySchema>;

/**
 * ISO 4217 minor-unit exponent of every sale currency: an amount of `n` minor
 * units is `n / 10^exponent` major units (2 for MYR: 123450 sen = RM 1,234.50).
 *
 * This table — not ICU's display precision — is the source of truth for
 * converting the integer minor units the API sends. ICU's default fraction
 * digits are a display convention and differ from ISO 4217 for several
 * currencies (IDR, HUF and COP display 0 decimals but have 2 minor digits;
 * IQD displays 0 but has 3), so deriving the exponent from `Intl` silently
 * mis-scales money. Adding a currency to {@link SaleCurrencySchema} fails to
 * compile until its exponent is added here.
 */
export const SALE_CURRENCY_MINOR_UNIT_EXPONENTS: Readonly<Record<SaleCurrency, number>> = {
	MYR: 2,
};

/** The currency every sale is recorded in until multi-currency merchants exist. */
export const DEFAULT_SALE_CURRENCY: SaleCurrency = "MYR";

/** Most rewards one POS checkout may redeem on a single bill. */
export const MAX_CHECKOUT_REWARDS = 10;

/** Largest bill a POS may report, in minor units (RM 1,000,000.00) — guards against unit mix-ups (ringgit sent as sen). */
export const MAX_BILL_TOTAL_MINOR = 100_000_000;

/** Minor units per major unit (sen per ringgit). */
export const MINOR_UNITS_PER_MAJOR = 100;

/**
 * `POST /redemptions/checkout` — after the customer has paid, the POS reports
 * the bill and every reward redeemed on it. All-or-nothing: if any code is
 * invalid nothing is redeemed. Idempotent: retrying with the same
 * `idempotencyKey` and payload replays the original result.
 */
export const RedemptionCheckoutSchema = z
	.object({
		idempotencyKey: z.uuid(),
		billTotalMinor: z.number().int().nonnegative().max(MAX_BILL_TOTAL_MINOR),
		currency: SaleCurrencySchema,
		codes: z.array(RedemptionCodeSchema).min(1).max(MAX_CHECKOUT_REWARDS),
	})
	.strict();

export type RedemptionCheckoutInput = z.output<typeof RedemptionCheckoutSchema>;

// ── Merchant reward CRUD ─────────────────────────────────────────────────

export const RewardLocationScopeFieldsSchema = z
	.object({
		locationScopeType: OrganizationLocationScopeTypeSchema.optional().default("ALL_LOCATIONS"),
		locationIds: z.array(z.uuid()).optional().default([]),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.locationScopeType === "SELECTED" && value.locationIds.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Select at least one store when limiting reward availability",
				path: ["locationIds"],
			});
		}
	});

export type RewardLocationScopeFields = z.output<typeof RewardLocationScopeFieldsSchema>;

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
		if (value.locationScopeType === "SELECTED" && value.locationIds.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Select at least one store when limiting reward availability",
				path: ["locationIds"],
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
		if (value.locationScopeType === "SELECTED" && (value.locationIds === undefined || value.locationIds.length === 0)) {
			ctx.addIssue({
				code: "custom",
				message: "Select at least one store when limiting reward availability",
				path: ["locationIds"],
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
	if (segments.length < 3) {
		return EpochMsSchema.parse(Number.NaN);
	}
	const year = Number(segments[0]);
	const month = Number(segments[1]);
	const day = Number(segments[2]);
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

/** Longest POS API key (terminal) name — shared by the create form and the API. */
export const MERCHANT_API_KEY_NAME_MAX_LENGTH = 100;

/**
 * What a merchant API key may call (mirrors the Prisma `OrganizationApiKeyScope` enum):
 * - `POS` — a till: only the POS redemption routes (`/redemptions/*`). Every key a
 *   terminal receives by pairing is a POS key.
 * - `INTEGRATION` — a back-office integration: the POS routes plus the organization
 *   reward / redemption-history / analytics API.
 */
export const OrganizationApiKeyScopeSchema = z.enum(["POS", "INTEGRATION"]);

export type OrganizationApiKeyScope = z.output<typeof OrganizationApiKeyScopeSchema>;

/** The scope a manually created key gets when none is chosen — least privilege. */
export const DEFAULT_MERCHANT_API_KEY_SCOPE: OrganizationApiKeyScope = "POS";

/**
 * `POST /orgs/:orgSlug/api-keys`. `locationId` limits the key to one store; a member
 * limited to some stores must choose one of them (only an all-stores member may create
 * an organization-wide key).
 */
export const MerchantCreateApiKeySchema = z
	.object({
		name: z.string().trim().min(1).max(MERCHANT_API_KEY_NAME_MAX_LENGTH).optional(),
		locationId: z.uuid().optional(),
		scope: OrganizationApiKeyScopeSchema.optional().default(DEFAULT_MERCHANT_API_KEY_SCOPE),
	})
	.strict();

/**
 * `GET /orgs/:orgSlug/api-keys` list query — newest first, `filter[revokedAt][isNull]=true`
 * lists active keys. `locationId` is an authorization SCOPE (checked against the member's stores).
 * Pages are as large as the grammar allows: an organization has a handful of terminal keys.
 */
/** One page holds every key a store realistically has; the merchant page says so when there are more. */
export const MERCHANT_API_KEYS_PAGE_SIZE = LIST_MAX_LIMIT;

export const merchantApiKeyListQuery = defineListQuery({
	sortable: ["createdAt", "name"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		revokedAt: listFilter.epochMs({ isNull: true }),
	},
	params: OrganizationLocationFilterSchema.shape,
	defaultLimit: MERCHANT_API_KEYS_PAGE_SIZE,
});
export const MerchantApiKeyListQuerySchema = merchantApiKeyListQuery.schema;
export type MerchantApiKeyListQuery = z.output<typeof MerchantApiKeyListQuerySchema>;
export type MerchantApiKeyListSortField = (typeof merchantApiKeyListQuery.sortable)[number];

// ── POS terminals (pairing) ──────────────────────────────────────────────

/** How long a terminal pairing code stays usable (15 minutes). */
export const POS_PAIRING_CODE_TTL_MS = 15 * 60 * 1000;

/** One-time pairing code a till enters once: 8 characters, same unambiguous alphabet as backup codes. */
export const PosPairingCodeSchema = RewardBackupCodeSchema;

export type PosPairingCode = z.output<typeof PosPairingCodeSchema>;

/** Longest terminal display name (matches the `label` column). */
export const POS_TERMINAL_NAME_MAX_LENGTH = 100;

/**
 * A terminal's state, derived (never stored): `AWAITING_PAIRING` while a code
 * is live, `ACTIVE` once paired with a key that still works, `UNPAIRED`
 * otherwise (code expired, key revoked, or registered without pairing).
 */
export const PosTerminalStatusSchema = z.enum(["AWAITING_PAIRING", "ACTIVE", "UNPAIRED"]);

export type PosTerminalStatus = z.output<typeof PosTerminalStatusSchema>;

/**
 * `POST /orgs/:orgSlug/terminals` — every till belongs to one store. `terminalId` is the
 * merchant's own till label (what the till sends as `X-Terminal-Id`); omit it to get a
 * generated `TERM-…` id. A label already used by a live terminal of the organization is
 * refused (409 `TERMINAL_ID_TAKEN`); a removed terminal's label may be reused.
 */
export const MerchantCreateTerminalSchema = z
	.object({
		name: z.string().trim().min(1).max(POS_TERMINAL_NAME_MAX_LENGTH),
		locationId: z.uuid(),
		terminalId: PosTerminalIdSchema.optional(),
	})
	.strict();

export type MerchantCreateTerminalInput = z.output<typeof MerchantCreateTerminalSchema>;

/** `GET /orgs/:orgSlug/terminals` — newest first; `locationId` is an authorization SCOPE. */
export const merchantTerminalListQuery = defineListQuery({
	sortable: ["createdAt", "name"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {},
	params: OrganizationLocationFilterSchema.shape,
	defaultLimit: LIST_MAX_LIMIT,
});
export const MerchantTerminalListQuerySchema = merchantTerminalListQuery.schema;
export type MerchantTerminalListQuery = z.output<typeof MerchantTerminalListQuerySchema>;
export type MerchantTerminalListSortField = (typeof merchantTerminalListQuery.sortable)[number];

/** One page holds every till a merchant realistically has. */
export const MERCHANT_TERMINALS_PAGE_SIZE = LIST_MAX_LIMIT;

/** `GET` / `PATCH /orgs/:orgSlug/terminals/settings` — organization-wide POS policy. */
export const MerchantTerminalSettingsSchema = z
	.object({
		/** When on, POS calls with a manually created API key must come from a registered terminal id. */
		requireRegisteredTerminals: z.boolean(),
	})
	.strict();

export type MerchantTerminalSettings = z.output<typeof MerchantTerminalSettingsSchema>;

/** The same settings as the API RETURNS them — open, so additive fields never break a client (ADR 022). */
export const MerchantTerminalSettingsResponseSchema = z.object({ requireRegisteredTerminals: z.boolean() });

/** `POST /pos/terminals/pair` — the till's one call with the code shown in the merchant console. */
export const PosPairTerminalSchema = z.object({ pairingCode: PosPairingCodeSchema }).strict();

export type PosPairTerminalInput = z.output<typeof PosPairTerminalSchema>;

export const MerchantRewardListQuerySchema = OrganizationLocationFilterSchema;

export type MerchantRewardListQuery = z.output<typeof MerchantRewardListQuerySchema>;

export type MerchantCreateApiKeyInput = z.output<typeof MerchantCreateApiKeySchema>;

// ── Admin ──────────────────────────────────────────────────────────────────

export const AdminCreateMerchantInviteSchema = z
	.object({
		email: CanonicalEmailSchema,
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

export const AdminMerchantIdParamSchema = z
	.object({
		organizationId: z.uuid(),
	})
	.strict();

export type AdminMerchantIdParam = z.output<typeof AdminMerchantIdParamSchema>;

export const AdminMerchantInviteCreatedResponseSchema = z.object({
	inviteId: z.uuid(),
	inviteToken: z.string().min(1),
	expiresAt: EpochMsSchema,
});

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

/** Admin merchant detail for KYB review — includes verification payload and owner context. */
export const AdminMerchantDetailResponseSchema = MerchantOrgResponseSchema.extend({
	kybFields: JsonObjectSchema.nullable(),
	documents: z.array(MerchantKybDocumentRecordSchema),
	locations: z.array(OrganizationLocationResponseSchema),
	ownerUserId: z.uuid().nullable(),
	ownerEmail: z.string().nullable(),
	ownerFullName: z.string().nullable(),
	memberCount: z.number().int().nonnegative(),
});

export type AdminMerchantDetailResponse = z.output<typeof AdminMerchantDetailResponseSchema>;

/** Organization-scoped RewardHub membership list item (replaces legacy OrganizationRewardMembershipResponse). */
export const OrganizationRewardMembershipResponseSchema = z.object({
	organizationId: z.uuid(),
	organizationSlug: OrganizationSlugSchema,
	displayName: z.string(),
	role: z.enum(["OWNER", "ADMIN", "MEMBER", "POLICY_ADMIN", "CASHIER"]),
	kybStatus: KybStatusSchema,
	lifecycleState: z.enum(["PROVISIONING", "ACTIVE", "RESTRICTED", "SUSPENDED", "PENDING_DELETION", "DELETED"]),
	createdAt: EpochMsSchema.optional(),
});

export type OrganizationRewardMembershipResponse = z.output<typeof OrganizationRewardMembershipResponseSchema>;

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
	rules: RewardRulesResponseSchema.nullable(),
	shareUrl: z.url().optional(),
	locationScopeType: OrganizationLocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	locationNames: z.array(z.string()).optional(),
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

export const RewardClaimCreatedResponseSchema = z.object({
	claim: RewardClaimResponseSchema,
	qrDeepLink: z.string(),
	backupCode: RewardBackupCodeSchema,
});

export type RewardClaimCreatedResponse = z.output<typeof RewardClaimCreatedResponseSchema>;

export const RewardClaimQrResponseSchema = z.object({
	claimId: z.uuid(),
	qrPayload: z.string(),
	backupCode: RewardBackupCodeSchema,
	claimExpiresAt: EpochMsSchema,
});

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

/**
 * Why a scanned code cannot be redeemed right now (`null` when it can).
 * `STORE_REQUIRED`: the reward is limited to selected stores, but the call
 * carries no store (an organization-wide key with an unregistered terminal id),
 * so the till must be registered to its store first.
 */
export const RedemptionInvalidReasonSchema = z.enum(["ALREADY_REDEEMED", "EXPIRED", "NOT_VALID_AT_STORE", "STORE_REQUIRED"]);

export type RedemptionInvalidReason = z.output<typeof RedemptionInvalidReasonSchema>;

export const RedemptionPreviewResponseSchema = z.object({
	claimId: z.uuid(),
	rewardTitle: z.string(),
	rewardType: RewardTypeSchema,
	claimExpiresAt: EpochMsSchema,
	valid: z.boolean(),
	invalidReason: RedemptionInvalidReasonSchema.nullable(),
	/** The reward's minimum bill, in minor units — the POS should not check out a smaller bill. */
	minSpendMinor: z.number().int().nonnegative().nullable(),
});

export type RedemptionPreviewResponse = z.output<typeof RedemptionPreviewResponseSchema>;

export const RedemptionCheckoutItemSchema = z.object({
	redemptionId: z.uuid(),
	claimId: z.uuid(),
	rewardId: z.uuid(),
	rewardTitle: z.string(),
});

export type RedemptionCheckoutItem = z.output<typeof RedemptionCheckoutItemSchema>;

export const RedemptionCheckoutResponseSchema = z.object({
	saleId: z.uuid(),
	billTotalMinor: z.number().int().nonnegative(),
	currency: SaleCurrencySchema,
	paidAt: EpochMsSchema,
	idempotencyKey: z.uuid(),
	redemptions: z.array(RedemptionCheckoutItemSchema),
});

export type RedemptionCheckoutResponse = z.output<typeof RedemptionCheckoutResponseSchema>;

export const MerchantApiKeySummarySchema = BaseResponseSchema.extend({
	id: z.uuid(),
	name: z.string(),
	locationId: z.uuid().nullable(),
	locationName: z.string().nullable(),
	scope: OrganizationApiKeyScopeSchema,
	revokedAt: EpochMsSchema.nullable(),
});

export type MerchantApiKeySummary = z.output<typeof MerchantApiKeySummarySchema>;

export const MerchantApiKeyCreatedSchema = z.object({
	id: z.uuid(),
	apiKey: z.string(),
	name: z.string(),
	scope: OrganizationApiKeyScopeSchema,
	locationId: z.uuid().nullable(),
});

export type MerchantApiKeyCreated = z.output<typeof MerchantApiKeyCreatedSchema>;

export const MerchantTerminalSummarySchema = BaseResponseSchema.extend({
	id: z.uuid(),
	/** What the till sends as `X-Terminal-Id` (the merchant's label, or generated, e.g. `TERM-7F3K9QX2`). */
	terminalId: PosTerminalIdSchema,
	name: z.string(),
	locationId: z.uuid(),
	locationName: z.string(),
	status: PosTerminalStatusSchema,
	/** While `AWAITING_PAIRING`: when the live code stops working. */
	pairingCodeExpiresAt: EpochMsSchema.nullable(),
	pairedAt: EpochMsSchema.nullable(),
	lastSeenAt: EpochMsSchema.nullable(),
});

export type MerchantTerminalSummary = z.output<typeof MerchantTerminalSummarySchema>;

/** `GET /orgs/:orgSlug/terminals/summary` query — `locationId` narrows to one of the caller's stores (an authorization SCOPE). */
export const MerchantTerminalStatusSummaryQuerySchema = OrganizationLocationFilterSchema;

export type MerchantTerminalStatusSummaryQuery = z.output<typeof MerchantTerminalStatusSummaryQuerySchema>;

/** Live terminals per derived status (see {@link PosTerminalStatusSchema}); every status is always present. */
export const MerchantTerminalStatusCountsSchema = z.object({
	AWAITING_PAIRING: z.number().int().nonnegative(),
	ACTIVE: z.number().int().nonnegative(),
	UNPAIRED: z.number().int().nonnegative(),
});

export type MerchantTerminalStatusCounts = z.output<typeof MerchantTerminalStatusCountsSchema>;

/**
 * `GET /orgs/:orgSlug/terminals/summary` — the caller's live terminals at a glance, within its
 * store scope (a store-limited member never counts another store's tills).
 */
export const MerchantTerminalStatusSummarySchema = z.object({
	/** Live terminals in scope. Equals the sum of `byStatus`. */
	total: z.number().int().nonnegative(),
	byStatus: MerchantTerminalStatusCountsSchema,
	/** Stores in scope that have at least one live terminal. */
	storesWithTerminals: z.number().int().nonnegative(),
});

export type MerchantTerminalStatusSummary = z.output<typeof MerchantTerminalStatusSummarySchema>;

/** A terminal plus its one-time pairing code — the only time the code is ever returned. */
export const MerchantTerminalPairingSchema = z.object({
	terminal: MerchantTerminalSummarySchema,
	pairingCode: PosPairingCodeSchema,
	pairingCodeExpiresAt: EpochMsSchema,
});

export type MerchantTerminalPairing = z.output<typeof MerchantTerminalPairingSchema>;

/** What a till receives when it pairs: its own API key (shown once) and who it now belongs to. */
export const PosPairedTerminalSchema = z.object({
	apiKey: z.string(),
	terminalId: PosTerminalIdSchema,
	terminalName: z.string(),
	organization: z.object({ slug: z.string(), displayName: z.string() }),
	location: z.object({ id: z.uuid(), name: z.string() }),
});

export type PosPairedTerminal = z.output<typeof PosPairedTerminalSchema>;

export const MerchantRedemptionListItemSchema = z.object({
	redemptionId: z.uuid(),
	rewardTitle: z.string(),
	redeemedAt: EpochMsSchema,
	terminalId: z.string(),
	redemptionMethod: RewardRedemptionMethodSchema,
});

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
		organizationId: z.uuid().nullable(),
		metadata: JsonObjectSchema,
		durationMs: z.number().int().nonnegative().optional(),
	})
	.strict();

export type RewardPlatformEvent = z.output<typeof RewardPlatformEventSchema>;

/** `GET /orgs/memberships` / `GET /orgs/:orgSlug/memberships` payload. */
export const OrganizationRewardMembershipListResponseSchema = z.array(OrganizationRewardMembershipResponseSchema);

/** A whole (bounded) reward catalog — an organization's rewards, the admin pending queue. */
export const RewardResponseListSchema = z.array(RewardResponseSchema);

/** `GET /reward-notifications` payload: one keyset page of notifications plus the unread badge count. */
export const RewardNotificationListResponseSchema = z.object({
	items: z.array(RewardNotificationResponseSchema),
	unreadCount: z.number().int().nonnegative(),
	nextCursor: z.string().nullable(),
	hasNext: z.boolean(),
});

export type RewardNotificationListResponse = z.output<typeof RewardNotificationListResponseSchema>;
