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
	"merchant:create_rewards": {
		label: "Create rewards",
		description: "Draft new reward campaigns.",
		groupName: "Rewards",
		sortOrder: 11,
	},
	"merchant:manage_rewards": {
		label: "Edit rewards",
		description: "Edit reward campaigns, their stores, images and audience, and pick the customers they go to.",
		groupName: "Rewards",
		sortOrder: 12,
	},
	"merchant:publish_rewards": {
		label: "Publish rewards",
		description: "Submit a reward campaign for review so it goes live.",
		groupName: "Rewards",
		sortOrder: 13,
	},
	"merchant:view_customer_bans": {
		label: "View banned customers",
		description: "See the customers banned from the business's rewards.",
		groupName: "Rewards",
		sortOrder: 14,
	},
	"merchant:ban_customers": {
		label: "Ban customers",
		description: "Ban a customer from the business's rewards.",
		groupName: "Rewards",
		sortOrder: 15,
	},
	"merchant:lift_customer_bans": {
		label: "Lift customer bans",
		description: "Lift a customer's ban.",
		groupName: "Rewards",
		sortOrder: 16,
	},
	"merchant:view_redemptions": {
		label: "View redemptions",
		description: "Review POS redemption activity and history.",
		groupName: "Operations",
		sortOrder: 20,
	},
	"merchant:view_api_keys": {
		label: "View API keys",
		description: "See the POS API keys and the till settings.",
		groupName: "Operations",
		sortOrder: 21,
	},
	"merchant:manage_api_keys": {
		label: "Create API keys",
		description: "Create POS API keys and change the till settings.",
		groupName: "Operations",
		sortOrder: 22,
	},
	"merchant:revoke_api_keys": {
		label: "Revoke API keys",
		description: "Revoke a POS API key.",
		groupName: "Operations",
		sortOrder: 23,
	},
	"merchant:view_terminals": {
		label: "View tills",
		description: "See the registered tills and whether each is paired.",
		groupName: "Operations",
		sortOrder: 24,
	},
	"merchant:manage_terminals": {
		label: "Register tills",
		description: "Register a till and issue its pairing code.",
		groupName: "Operations",
		sortOrder: 25,
	},
	"merchant:remove_terminals": {
		label: "Remove tills",
		description: "Remove a till and revoke its key.",
		groupName: "Operations",
		sortOrder: 26,
	},
	"merchant:view_analytics": {
		label: "View analytics",
		description: "Access performance and redemption analytics.",
		groupName: "Insights",
		sortOrder: 30,
	},
	"merchant:view_team": {
		label: "View team",
		description: "See the member roster and pending invitations.",
		groupName: "Tenant",
		sortOrder: 39,
	},
	"merchant:manage_team": {
		label: "Manage team",
		description: "Change members, their roles and their store access, and manage the tenant's roles.",
		groupName: "Tenant",
		sortOrder: 40,
	},
	"merchant:invite_members": {
		label: "Invite members",
		description: "Invite someone to the team.",
		groupName: "Tenant",
		sortOrder: 44,
	},
	"merchant:revoke_invites": {
		label: "Revoke invitations",
		description: "Revoke a pending invitation.",
		groupName: "Tenant",
		sortOrder: 45,
	},
	"merchant:approve_access_requests": {
		label: "Approve join requests",
		description: "Approve a request to join the team.",
		groupName: "Tenant",
		sortOrder: 46,
	},
	"merchant:reject_access_requests": {
		label: "Reject join requests",
		description: "Reject a request to join the team.",
		groupName: "Tenant",
		sortOrder: 47,
	},
	"merchant:view_verification": {
		label: "View business verification",
		description: "Read the business verification (KYB) details and documents.",
		groupName: "Tenant",
		sortOrder: 48,
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
		description: "Submit business verification (KYB) details and documents, and appeal a suspension.",
		groupName: "Tenant",
		sortOrder: 43,
	},
	"merchant:view_notifications": {
		label: "View notification deliveries",
		description: "See what the business sent its customers, on which channel, and whether it arrived.",
		groupName: "Customers",
		sortOrder: 50,
	},
	"merchant:view_broadcasts": {
		label: "View broadcasts",
		description: "See the business's announcements, their audience counts and the weekly allowance.",
		groupName: "Customers",
		sortOrder: 51,
	},
	"merchant:create_broadcasts": {
		label: "Draft broadcasts",
		description: "Start a new announcement to the business's customers.",
		groupName: "Customers",
		sortOrder: 52,
	},
	"merchant:manage_broadcasts": {
		label: "Edit broadcasts",
		description: "Edit announcement drafts and their images.",
		groupName: "Customers",
		sortOrder: 53,
	},
	"merchant:publish_broadcasts": {
		label: "Send broadcasts",
		description: "Schedule or cancel an announcement, and approve another member's so it is sent.",
		groupName: "Customers",
		sortOrder: 54,
	},
	"merchant:view_payments": {
		label: "View payments",
		description: "Follow the business's payments.",
		groupName: "Payments",
		sortOrder: 60,
	},
	"merchant:manage_payments": {
		label: "Take payments",
		description: "Ask customers to pay through Billplz or CHIP.",
		groupName: "Payments",
		sortOrder: 61,
	},
	"merchant:refund_payments": {
		label: "Refund payments",
		description: "Refund a paid payment.",
		groupName: "Payments",
		sortOrder: 62,
	},
	"merchant:view_webhooks": {
		label: "View webhooks",
		description: "See the business's webhook endpoints and their delivery log.",
		groupName: "Operations",
		sortOrder: 27,
	},
	"merchant:create_webhooks": {
		label: "Add webhooks",
		description: "Add a webhook endpoint that receives the business's events.",
		groupName: "Operations",
		sortOrder: 28,
	},
	"merchant:manage_webhooks": {
		label: "Manage webhooks",
		description: "Change webhook endpoints, rotate their signing secrets, test them and redeliver.",
		groupName: "Operations",
		sortOrder: 29,
	},
	"merchant:delete_webhooks": {
		label: "Delete webhooks",
		description: "Delete a webhook endpoint.",
		groupName: "Operations",
		sortOrder: 31,
	},
};

/** MERCHANT-scope catalog rows in the shared vocabulary's order. */
export const MERCHANT_CAPABILITY_CATALOG: readonly MerchantCapabilityCatalogEntry[] = MerchantCapabilitySchema.options.map((slug): MerchantCapabilityCatalogEntry => ({
	slug,
	...MERCHANT_CAPABILITY_CATALOG_DETAILS[slug],
}));
