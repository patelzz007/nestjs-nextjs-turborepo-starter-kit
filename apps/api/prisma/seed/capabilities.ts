import { type CapabilitySlug } from "@workspace/shared";

import { prisma } from "./client";

interface MerchantCapabilityCatalogEntry {
	readonly slug: CapabilitySlug;
	readonly label: string;
	readonly description: string;
	readonly groupName: string;
	readonly sortOrder: number;
}

/** MERCHANT-scope catalog rows — Cedar policies grant these at org provisioning time. */
const MERCHANT_CAPABILITY_CATALOG: readonly MerchantCapabilityCatalogEntry[] = [
	{
		slug: "merchant:view_dashboard",
		label: "View dashboard",
		description: "Access the merchant home dashboard and summary widgets.",
		groupName: "Overview",
		sortOrder: 0,
	},
	{
		slug: "merchant:view_rewards",
		label: "View rewards",
		description: "Browse the store reward catalog and campaign status.",
		groupName: "Rewards",
		sortOrder: 10,
	},
	{
		slug: "merchant:manage_rewards",
		label: "Manage rewards",
		description: "Create, edit, publish, and archive reward campaigns.",
		groupName: "Rewards",
		sortOrder: 11,
	},
	{
		slug: "merchant:view_redemptions",
		label: "View redemptions",
		description: "Review POS redemption activity and history.",
		groupName: "Operations",
		sortOrder: 20,
	},
	{
		slug: "merchant:manage_api_keys",
		label: "Manage API keys",
		description: "Create and revoke POS terminal API keys.",
		groupName: "Operations",
		sortOrder: 21,
	},
	{
		slug: "merchant:view_analytics",
		label: "View analytics",
		description: "Access performance and redemption analytics.",
		groupName: "Insights",
		sortOrder: 30,
	},
];

export interface MerchantCapabilitySeedSummary {
	readonly definitions: number;
}

/** Seeds MERCHANT capability catalog definitions (authorization via Cedar tenant policies). */
export async function seedMerchantCapabilities(): Promise<MerchantCapabilitySeedSummary> {
	const now: number = Date.now();

	for (const entry of MERCHANT_CAPABILITY_CATALOG) {
		await prisma.capabilityDefinition.upsert({
			where: { slug: entry.slug },
			create: {
				slug: entry.slug,
				scope: "MERCHANT",
				label: entry.label,
				description: entry.description,
				groupName: entry.groupName,
				sortOrder: entry.sortOrder,
				isSystem: true,
			},
			update: {
				scope: "MERCHANT",
				label: entry.label,
				description: entry.description,
				groupName: entry.groupName,
				sortOrder: entry.sortOrder,
				isSystem: true,
				isDeleted: false,
				deletedAt: null,
				updatedAt: now,
			},
		});
	}

	return {
		definitions: MERCHANT_CAPABILITY_CATALOG.length,
	};
}
