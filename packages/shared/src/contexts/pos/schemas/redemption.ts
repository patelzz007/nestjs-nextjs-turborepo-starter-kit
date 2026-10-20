import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter } from "../../../schemas/api/list-query";
import { RewardBackupCodeSchema } from "../../claims/schemas/claim-enums";
import { LocationFilterSchema } from "../../tenancy/schemas/location-filter";
import { REWARD_LIST_DEFAULT_LIMIT } from "../../rewards/schemas/reward";
import { RewardTypeSchema } from "../../rewards/schemas/reward-enums";
import { RewardRedemptionMethodSchema } from "./pos-enums";

// ── POS redemption: validate / checkout at the till, and the merchant's redemption history ──

/**
 * `GET /tenants/:tenantSlug/redemptions` list query. `locationId` is an authorization SCOPE (checked against the member's stores), not a filter.
 * `filter[redeemedAt][gte]` / `[lt]` narrow to a time window — e.g. "today" in the viewer's time zone; the response's
 * `meta.total` is then the server-side count of that window (never a count of the rows on one page).
 */
export const merchantRedemptionListQuery = defineListQuery({
	sortable: ["redeemedAt"],
	defaultSort: [{ field: "redeemedAt", direction: "desc" }],
	filter: {
		redeemedAt: listFilter.epochMs({ gte: true, lt: true }),
	},
	params: LocationFilterSchema.shape,
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});

export const MerchantRedemptionListQuerySchema = merchantRedemptionListQuery.schema;

export type MerchantRedemptionListQuery = z.output<typeof MerchantRedemptionListQuerySchema>;

export type MerchantRedemptionListSortField = (typeof merchantRedemptionListQuery.sortable)[number];

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

export type PosTerminalId = z.output<typeof PosTerminalIdSchema>;

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
 * `POST /integration/redemptions/checkout` — after the customer has paid, the POS reports
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

/**
 * Why a scanned code cannot be redeemed right now (`null` when it can).
 * `STORE_REQUIRED`: the reward is limited to selected stores, but the call
 * carries no store (a tenant-wide key with an unregistered terminal id),
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

export const MerchantRedemptionListItemSchema = z.object({
	redemptionId: z.uuid(),
	rewardTitle: z.string(),
	redeemedAt: EpochMsSchema,
	terminalId: z.string(),
	redemptionMethod: RewardRedemptionMethodSchema,
});

export type MerchantRedemptionListItem = z.output<typeof MerchantRedemptionListItemSchema>;
