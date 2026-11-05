import { MerchantCapabilitySchema, type MerchantCapability } from "@workspace/shared";

export interface MerchantCapabilityCatalogDetails {
	readonly label: string;
	readonly description: string;
	readonly groupName: string;
	readonly sortOrder: number;
}

export interface MerchantCapabilityCatalogEntry extends MerchantCapabilityCatalogDetails {
	readonly slug: MerchantCapability;
}

/**
 * Display metadata for every MERCHANT-scope capability (`CapabilityDefinition`
 * rows). A `Record` over the shared vocabulary, so a new `MERCHANT_CAPABILITY`
 * cannot ship without its catalog row. Which roles hold each capability is the
 * tenant's own roles' permissions (ADR 067), not this table.
 */
const MERCHANT_CAPABILITY_CATALOG_DETAILS: Readonly<Record<MerchantCapability, MerchantCapabilityCatalogDetails>> = {
	"merchant:view_dashboard": {
		label: "View dashboard",
		description: "Access the merchant home dashboard and summary widgets.",
		groupName: "Overview",
		sortOrder: 0,
	},
	"merchant:view_rewards": {
		label: "View rewards",
		description: "Browse the store reward catalog and campaign status.",
		groupName: "Rewards",
		sortOrder: 10,
	},
	"merchant:manage_rewards": {
		label: "Manage rewards",
		description: "Create, edit, publish, and archive reward campaigns.",
		groupName: "Rewards",
		sortOrder: 11,
	},
	"merchant:view_redemptions": {
		label: "View redemptions",
		description: "Review POS redemption activity and history.",
		groupName: "Operations",
		sortOrder: 20,
	},
	"merchant:manage_api_keys": {
		label: "Manage API keys",
		description: "Create and revoke POS terminal API keys.",
		groupName: "Operations",
		sortOrder: 21,
	},
	"merchant:view_analytics": {
		label: "View analytics",
		description: "Access performance and redemption analytics.",
		groupName: "Insights",
		sortOrder: 30,
	},
	"merchant:manage_team": {
		label: "Manage team",
		description: "View the member roster, invite members, and revoke pending invitations.",
		groupName: "Tenant",
		sortOrder: 40,
	},
	"merchant:view_locations": {
		label: "View store locations",
		description: "See every store location of the tenant and your own location access scope.",
		groupName: "Tenant",
		sortOrder: 41,
	},
	"merchant:manage_locations": {
		label: "Manage store locations",
		description: "Request new stores, resubmit rejected requests, and change store branding.",
		groupName: "Tenant",
		sortOrder: 42,
	},
	"merchant:manage_verification": {
		label: "Manage business verification",
		description: "Read and submit business verification (KYB) details and documents.",
		groupName: "Tenant",
		sortOrder: 43,
	},
	"merchant:view_notifications": {
		label: "View notification deliveries",
		description: "See what the business sent its customers, on which channel, and whether it arrived.",
		groupName: "Customers",
		sortOrder: 50,
	},
	"merchant:manage_broadcasts": {
		label: "Manage broadcasts",
		description: "Draft, edit, schedule and submit announcements to the business's customers.",
		groupName: "Customers",
		sortOrder: 51,
	},
	"merchant:publish_broadcasts": {
		label: "Approve broadcasts",
		description: "Approve another member's broadcast so it is sent.",
		groupName: "Customers",
		sortOrder: 52,
	},
	"merchant:manage_payments": {
		label: "Manage payments",
		description: "Ask customers to pay through Billplz or CHIP, follow each payment, and refund it.",
		groupName: "Payments",
		sortOrder: 60,
	},
	"merchant:manage_webhooks": {
		label: "Manage webhooks",
		description: "Send the business's events to its own systems: add webhook endpoints, rotate their signing secrets, read the delivery log and redeliver.",
		groupName: "Operations",
		sortOrder: 23,
	},
};

/** MERCHANT-scope catalog rows in the shared vocabulary's order. */
export const MERCHANT_CAPABILITY_CATALOG: readonly MerchantCapabilityCatalogEntry[] = MerchantCapabilitySchema.options.map((slug): MerchantCapabilityCatalogEntry => ({
	slug,
	...MERCHANT_CAPABILITY_CATALOG_DETAILS[slug],
}));
