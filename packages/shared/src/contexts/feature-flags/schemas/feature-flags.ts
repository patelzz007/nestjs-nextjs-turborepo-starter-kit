import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";

// ── Runtime feature flags (enhancement 5.6) ─────────────────────────────────────────────────────
// Each flag is declared here with the default it had before (its env or deployment fact). Staff can then turn
// it on or off for the deployment, or on for a stable percentage of people, from the admin console; every
// change is audited. Leaving a flag on DEFAULT keeps the old behaviour exactly.

export const FeatureFlagKeySchema = z.enum(["component-gallery", "merchant-invites", "till-redemption"]);
export type FeatureFlagKey = z.output<typeof FeatureFlagKeySchema>;

/**
 * Where a flag is decided (enhancement 5.11). `platform`: for the whole deployment (5.6). `store`: also per
 * merchant and per branch ("on for KL, off for Melaka"), the store's own setting deciding over the deployment's.
 */
export const FeatureFlagScopeSchema = z.enum(["platform", "store"]);
export type FeatureFlagScope = z.output<typeof FeatureFlagScopeSchema>;

/** The flags decided for the whole deployment only. */
export const PlatformFeatureFlagKeySchema = FeatureFlagKeySchema.exclude(["till-redemption"]);
export type PlatformFeatureFlagKey = z.output<typeof PlatformFeatureFlagKeySchema>;

/** The flags a merchant or a branch can be given its own setting of. */
export const StoreFeatureFlagKeySchema = FeatureFlagKeySchema.extract(["till-redemption"]);
export type StoreFeatureFlagKey = z.output<typeof StoreFeatureFlagKeySchema>;

export interface FeatureFlagDefinition {
	readonly title: string;
	readonly description: string;
	readonly defaultFrom: string;
	readonly scope: FeatureFlagScope;
}

/** What each flag is, where its default comes from (shown beside it in the console), and where it is decided. */
export const FEATURE_FLAG_REGISTRY: Readonly<Record<FeatureFlagKey, FeatureFlagDefinition>> = {
	"component-gallery": {
		title: "Component gallery",
		description: "The developer gallery and kanban board under Components in the admin console.",
		defaultFrom: "ADMIN_COMPONENT_GALLERY, otherwise on in every build except production",
		scope: "platform",
	},
	"merchant-invites": {
		title: "Merchant invites",
		description: "Inviting new merchants from the admin console.",
		defaultFrom: "Whether this deployment serves more than one tenant",
		scope: "platform",
	},
	"till-redemption": {
		title: "Till redemption",
		description: "Redeeming customers' reward codes at a store's till: the phone till and POS integrations. Off at a store, its tills refuse to redeem.",
		defaultFrom: "On at every store",
		scope: "store",
	},
};

/** A store flag's default where neither the deployment nor the store has a setting: what each flag did before flags. */
export const STORE_FEATURE_FLAG_DEFAULTS: Readonly<Record<StoreFeatureFlagKey, boolean>> = { "till-redemption": true };

/** DEFAULT follows the flag's default; ON/OFF override it; PERCENTAGE turns it on for that share of people. */
export const FeatureFlagModeSchema = z.enum(["DEFAULT", "ON", "OFF", "PERCENTAGE"]);
export type FeatureFlagMode = z.output<typeof FeatureFlagModeSchema>;

const PERCENT_MIN = 1;
const PERCENT_MAX = 99;
const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 500;
/** Buckets a percentage rollout is cut into. */
export const FEATURE_FLAG_BUCKETS = 100;

/** A flag's stored setting, as the apps evaluate it (no names: any staff member may read it). */
export const FeatureFlagSettingSchema = z.object({
	key: FeatureFlagKeySchema,
	mode: FeatureFlagModeSchema,
	percentage: z.number().int().min(PERCENT_MIN).max(PERCENT_MAX).nullable(),
});
export type FeatureFlagSetting = z.output<typeof FeatureFlagSettingSchema>;

export const FeatureFlagSettingsSchema = z.object({ settings: z.array(FeatureFlagSettingSchema) });
export type FeatureFlagSettings = z.output<typeof FeatureFlagSettingsSchema>;

/** A flag as the console's Feature flags page shows it. */
export const FeatureFlagSchema = FeatureFlagSettingSchema.extend({
	scope: FeatureFlagScopeSchema,
	title: z.string(),
	description: z.string(),
	defaultFrom: z.string(),
	reason: z.string().nullable(),
	updatedAt: EpochMsSchema.nullable(),
	updatedByName: z.string().nullable(),
});
export type FeatureFlag = z.output<typeof FeatureFlagSchema>;

export const FeatureFlagListSchema = z.object({ flags: z.array(FeatureFlagSchema) });
export type FeatureFlagList = z.output<typeof FeatureFlagListSchema>;

export const FeatureFlagPathSchema = z.object({ key: FeatureFlagKeySchema }).strict();
export type FeatureFlagPath = z.output<typeof FeatureFlagPathSchema>;

/** Changing a flag, with why (the audit trail keeps both). A percentage only with PERCENTAGE. */
export const UpdateFeatureFlagSchema = z
	.object({
		mode: FeatureFlagModeSchema,
		percentage: z.number().int().min(PERCENT_MIN).max(PERCENT_MAX).nullable(),
		reason: z.string().trim().min(REASON_MIN_LENGTH).max(REASON_MAX_LENGTH),
	})
	.strict()
	.refine((input) => (input.mode === "PERCENTAGE") === (input.percentage !== null), { message: "A percentage goes with PERCENTAGE, and only with it", path: ["percentage"] });
export type UpdateFeatureFlagInput = z.output<typeof UpdateFeatureFlagSchema>;

export const UpdateFeatureFlagInputSchema = FeatureFlagPathSchema.extend({
	mode: FeatureFlagModeSchema,
	percentage: z.number().int().min(PERCENT_MIN).max(PERCENT_MAX).nullable(),
	reason: z.string().trim().min(REASON_MIN_LENGTH).max(REASON_MAX_LENGTH),
});

const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;

/**
 * The person's bucket (0–99) for a flag: a stable FNV-1a hash of the flag and the person, so the same person
 * always gets the same answer and raising a percentage only ever adds people.
 */
export function featureFlagBucket(key: FeatureFlagKey, subjectId: string): number {
	let hash = FNV_OFFSET_BASIS;
	for (const character of `${key}:${subjectId}`) {
		hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME) >>> 0;
	}
	return hash % FEATURE_FLAG_BUCKETS;
}

/** Whether a flag is on: its setting when there is one, otherwise its default. A percentage needs a person. */
export function evaluateFeatureFlag(
	key: FeatureFlagKey,
	setting: Pick<FeatureFlagSetting, "mode" | "percentage"> | undefined,
	defaultOn: boolean,
	subjectId: string | null,
): boolean {
	switch (setting?.mode ?? "DEFAULT") {
		case "DEFAULT":
			return defaultOn;
		case "ON":
			return true;
		case "OFF":
			return false;
		case "PERCENTAGE":
			return subjectId !== null && featureFlagBucket(key, subjectId) < (setting?.percentage ?? 0);
	}
}

// ── Per-store settings (enhancement 5.11) ─────────────────────────────────────────────────────────

/** A store's own setting of a store flag: a whole merchant (no branch), or one branch of it. */
export const FeatureFlagStoreOverrideSchema = z.object({
	id: z.uuid(),
	key: StoreFeatureFlagKeySchema,
	tenantId: z.uuid(),
	tenantName: z.string(),
	/** `null`: every branch of the merchant (a branch's own setting still decides for that branch). */
	locationId: z.uuid().nullable(),
	locationName: z.string().nullable(),
	enabled: z.boolean(),
	reason: z.string(),
	updatedAt: EpochMsSchema,
	updatedByName: z.string().nullable(),
});
export type FeatureFlagStoreOverride = z.output<typeof FeatureFlagStoreOverrideSchema>;

export const FeatureFlagStoreOverrideListSchema = z.object({ overrides: z.array(FeatureFlagStoreOverrideSchema) });
export type FeatureFlagStoreOverrideList = z.output<typeof FeatureFlagStoreOverrideListSchema>;

export const StoreFeatureFlagPathSchema = z.object({ key: StoreFeatureFlagKeySchema }).strict();
export type StoreFeatureFlagPath = z.output<typeof StoreFeatureFlagPathSchema>;

/** Setting a store's own value of a flag (replaces its earlier one), with why. */
export const SetFeatureFlagStoreOverrideSchema = z
	.object({
		tenantId: z.uuid(),
		locationId: z.uuid().nullable(),
		enabled: z.boolean(),
		reason: z.string().trim().min(REASON_MIN_LENGTH).max(REASON_MAX_LENGTH),
	})
	.strict();
export type SetFeatureFlagStoreOverrideInput = z.output<typeof SetFeatureFlagStoreOverrideSchema>;

export const SetFeatureFlagStoreOverrideInputSchema = StoreFeatureFlagPathSchema.extend(SetFeatureFlagStoreOverrideSchema.shape);

/** Removing a store's own setting (it follows the deployment's again), with why. */
export const RemoveFeatureFlagStoreOverrideSchema = z.object({ reason: z.string().trim().min(REASON_MIN_LENGTH).max(REASON_MAX_LENGTH) }).strict();
export type RemoveFeatureFlagStoreOverrideInput = z.output<typeof RemoveFeatureFlagStoreOverrideSchema>;

export const FeatureFlagStoreOverridePathSchema = StoreFeatureFlagPathSchema.extend({ overrideId: z.uuid() });
export type FeatureFlagStoreOverridePath = z.output<typeof FeatureFlagStoreOverridePathSchema>;

export const RemoveFeatureFlagStoreOverrideInputSchema = FeatureFlagStoreOverridePathSchema.extend(RemoveFeatureFlagStoreOverrideSchema.shape);

/** The store a store flag is decided for: a merchant, and the branch when there is one (a till's). */
export interface StoreFlagTarget {
	readonly tenantId: string;
	readonly locationId: string | null;
}

/** A store's own settings of one flag, as stored: its merchant-wide one and its branch's, either may be missing. */
export interface StoreFeatureFlagOverrides {
	readonly merchant: boolean | null;
	readonly branch: boolean | null;
}

/**
 * Whether a store flag is on at a store: the branch's own setting, else the merchant's, else the deployment's
 * setting (5.6), else the flag's default. A percentage needs a person, as for any flag.
 */
export function evaluateStoreFeatureFlag(
	key: StoreFeatureFlagKey,
	overrides: StoreFeatureFlagOverrides,
	setting: Pick<FeatureFlagSetting, "mode" | "percentage"> | undefined,
	subjectId: string | null,
): boolean {
	return overrides.branch ?? overrides.merchant ?? evaluateFeatureFlag(key, setting, STORE_FEATURE_FLAG_DEFAULTS[key], subjectId);
}

/** The longest store search the flags page sends, and how many merchants it answers at most. */
const STORE_SEARCH_MAX_LENGTH = 100;
export const FEATURE_FLAG_STORE_SEARCH_LIMIT = 20;

/** Searching the stores a store flag can be set for: merchants by name, with their live branches. */
export const FeatureFlagStoreSearchQuerySchema = z.object({ search: z.string().trim().max(STORE_SEARCH_MAX_LENGTH).optional() }).strict();
export type FeatureFlagStoreSearchQuery = z.output<typeof FeatureFlagStoreSearchQuerySchema>;

export const FeatureFlagStoreOptionSchema = z.object({
	tenantId: z.uuid(),
	tenantName: z.string(),
	branches: z.array(z.object({ locationId: z.uuid(), name: z.string() })),
});
export type FeatureFlagStoreOption = z.output<typeof FeatureFlagStoreOptionSchema>;

export const FeatureFlagStoreOptionListSchema = z.object({ stores: z.array(FeatureFlagStoreOptionSchema) });
export type FeatureFlagStoreOptionList = z.output<typeof FeatureFlagStoreOptionListSchema>;
