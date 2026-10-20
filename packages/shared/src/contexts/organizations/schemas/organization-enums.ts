import { z } from "zod";

import { RewardCategorySchema } from "../../rewards/schemas/reward-enums";

// ── Organization enums (mirror Prisma — packages/shared cannot import @prisma/client) ───

export const PilotCitySchema = z.enum(["KUALA_LUMPUR", "MELAKA"]);
export type PilotCity = z.output<typeof PilotCitySchema>;

/** Display name of every pilot city — one copy for every app's filters, lists and copy. */
export const PILOT_CITY_LABELS: Readonly<Record<PilotCity, string>> = {
	KUALA_LUMPUR: "Kuala Lumpur",
	MELAKA: "Melaka",
};

/** IANA time zone of every pilot city — where its stores open, close and redeem. */
export const PILOT_CITY_TIME_ZONES: Readonly<Record<PilotCity, string>> = {
	KUALA_LUMPUR: "Asia/Kuala_Lumpur",
	MELAKA: "Asia/Kuala_Lumpur",
};

/** The locale and IANA time zone a date, time, count or money amount is rendered in. */
export interface DisplayRegion {
	/** BCP 47 locale tag, e.g. `en-MY`. */
	readonly locale: string;
	/** IANA time zone, e.g. `Asia/Kuala_Lumpur`. */
	readonly timeZone: string;
}

/**
 * The region every web, merchant and admin screen renders in: Malaysian English,
 * Malaysia time. Every pilot city is in this one zone (a test pins that
 * {@link PILOT_CITY_TIME_ZONES} agree with it), so a time shown in it is the
 * stores' own wall-clock time — what a customer redeeming in-store and a
 * merchant reading their redemptions both expect.
 *
 * Rendering in one fixed region instead of the runtime's default is what keeps
 * server-rendered HTML identical to the first client render: a Node server
 * (often UTC, `en-US`) and a browser (the viewer's own zone) would otherwise
 * format the same instant differently and React reports a hydration mismatch.
 */
export const PLATFORM_DISPLAY_REGION: DisplayRegion = {
	locale: "en-MY",
	timeZone: "Asia/Kuala_Lumpur",
};

export const MerchantOrgStatusSchema = z.enum(["ONBOARDING", "ACTIVE", "SUSPENDED"]);
export type MerchantOrgStatus = z.output<typeof MerchantOrgStatusSchema>;

export const KybStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "ACTION_REQUIRED"]);
export type KybStatus = z.output<typeof KybStatusSchema>;

/**
 * What a KYB document's malware scan means for the review — the API contract
 * shown to merchants and admins (not the database scan column):
 * - `SCANNING`    — verdict pending; the document cannot be opened yet.
 * - `CLEAN`       — scanned clean; downloadable.
 * - `NOT_SCANNED` — no malware scanner is configured; the document passed the
 *                   size / checksum / file-type checks only. Downloadable, but
 *                   reviewers must not treat it as malware-checked.
 * - `INFECTED`    — the scanner flagged it; the bytes were removed. Re-upload needed.
 * - `SCAN_FAILED` — no verdict could be obtained (the object was missing, or the
 *                   scanner stayed unavailable through every retry). Nothing was
 *                   found in it, but it was never cleared either. Re-upload needed.
 */
export const KybDocumentScanStatusSchema = z.enum(["SCANNING", "CLEAN", "NOT_SCANNED", "INFECTED", "SCAN_FAILED"]);
export type KybDocumentScanStatus = z.output<typeof KybDocumentScanStatusSchema>;

export const MerchantMemberRoleSchema = z.enum(["OWNER", "CASHIER"]);
export type MerchantMemberRole = z.output<typeof MerchantMemberRoleSchema>;

/** Merchant business type — same vocabulary as reward categories. */
export const MerchantBusinessCategorySchema = RewardCategorySchema;
export type MerchantBusinessCategory = z.output<typeof MerchantBusinessCategorySchema>;

export const MERCHANT_BUSINESS_CATEGORY_LABELS: Record<MerchantBusinessCategory, string> = {
	cafe: "Café",
	restaurant: "Restaurant",
	retail: "Retail",
	wellness: "Wellness",
	entertainment: "Entertainment",
	food: "Food",
	beverage: "Beverage",
};

/** Label for a merchant without a (recognised) business category — used by every sales / spending breakdown. */
export const UNCATEGORISED_MERCHANT_CATEGORY_LABEL = "Other";
