import { z } from "zod";

// ── The declared feature flags and dynamic configs (feature flags v2) ─────────────────────────────
// A key exists only here: the console configures the flags and configs the code declares and can't
// create one. Each declares its rollout unit (whose identity places a subject inside a percentage),
// the apps whose bundle carries it (`api` only: never sent to a client) and its code default.

/** The kind of subject a flag is decided per (GLOSSARY: rollout unit). */
export const RolloutUnitSchema = z.enum(["USER", "TENANT", "LOCATION", "DEVICE"]);
export type RolloutUnit = z.output<typeof RolloutUnitSchema>;

/** Where a flag's value is read: an app's bundle, or the API itself. */
export const FlagAppSchema = z.enum(["admin", "merchant", "web", "mobile", "api"]);
export type FlagApp = z.output<typeof FlagAppSchema>;

/** The apps that fetch a bundle (every app but the API itself). */
export const BundleAppSchema = FlagAppSchema.exclude(["api"]);
export type BundleApp = z.output<typeof BundleAppSchema>;

export const FeatureFlagKeySchema = z.enum(["showcase", "merchant-invites", "till-redemption", "customer-tiers", "merchant-analytics", "web-activity", "mobile-analytics"]);
export type FeatureFlagKey = z.output<typeof FeatureFlagKeySchema>;

export interface FeatureFlagDefinition {
	readonly title: string;
	readonly description: string;
	readonly rolloutUnit: RolloutUnit;
	readonly apps: readonly FlagApp[];
	/** The value when nothing else decides (no kill switch, override or matching rule). */
	readonly defaultOn: boolean;
	/**
	 * Decided for the whole deployment at once, never per subject: every bundle and check works it out with no
	 * person, store or device, so no two screens (or a screen and the API) ever disagree about it.
	 */
	readonly deploymentWide: boolean;
}

/** What each flag is and how it is decided. */
export const FEATURE_FLAG_REGISTRY: Readonly<Record<FeatureFlagKey, FeatureFlagDefinition>> = {
	showcase: {
		title: "Component showcase",
		description:
			"The developer component showcase and kanban board under Components in the admin console. Off by default; the seed turns it on outside production with a rule.",
		rolloutUnit: "USER",
		apps: ["admin"],
		defaultOn: false,
		deploymentWide: false,
	},
	"merchant-invites": {
		title: "Merchant invites",
		description: "Inviting new merchants from the admin console. A single-tenant deployment never offers invites, whatever this flag says.",
		rolloutUnit: "USER",
		apps: ["admin"],
		defaultOn: true,
		deploymentWide: false,
	},
	"till-redemption": {
		title: "Till redemption",
		description: "Redeeming customers' reward codes at a store's till: the phone till and POS integrations. Off at a store, its tills refuse to redeem.",
		rolloutUnit: "LOCATION",
		apps: ["api"],
		defaultOn: true,
		deploymentWide: false,
	},
	"customer-tiers": {
		title: "Customer tiers",
		description:
			"Bronze, Silver, Gold and Diamond tiers earned by redeeming rewards, and rewards for a minimum tier. Off, every customer is treated as Bronze, every reward is open to everyone and no tier changes happen. Decided for everyone at once: rules about a person or a share of people never apply to it.",
		rolloutUnit: "USER",
		apps: ["api", "admin"],
		defaultOn: true,
		deploymentWide: true,
	},
	"merchant-analytics": {
		title: "Merchant analytics",
		description: "The Analytics page in the merchant app, and its link in the sidebar.",
		rolloutUnit: "TENANT",
		apps: ["merchant", "api"],
		defaultOn: true,
		deploymentWide: false,
	},
	"web-activity": {
		title: "Web activity page",
		description: "The Activity page in the customer web app, and its link in the navigation.",
		rolloutUnit: "USER",
		apps: ["web"],
		defaultOn: true,
		deploymentWide: false,
	},
	"mobile-analytics": {
		title: "Mobile analytics tab",
		description: "The Analytics tab in the mobile app.",
		rolloutUnit: "USER",
		apps: ["mobile"],
		defaultOn: true,
		deploymentWide: false,
	},
};

/** The declared flags a bundle for `app` carries, in declaration order. */
export function featureFlagKeysFor(app: FlagApp): readonly FeatureFlagKey[] {
	return FeatureFlagKeySchema.options.filter((key) => FEATURE_FLAG_REGISTRY[key].apps.includes(app));
}
