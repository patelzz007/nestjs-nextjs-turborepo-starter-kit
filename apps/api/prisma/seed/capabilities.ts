import type { MerchantMemberRole } from "@prisma/client";
import { MerchantMemberRoleSchema, type CapabilitySlug } from "@workspace/shared";

import { DEFAULT_MERCHANT_ROLE_CAPABILITY_GRANTS } from "../../src/modules/rewards/constants/merchant-role-capability-defaults";

import { prisma } from "./client";

interface MerchantCapabilityCatalogEntry {
	readonly slug: CapabilitySlug;
	readonly label: string;
	readonly description: string;
	readonly groupName: string;
	readonly sortOrder: number;
}

/** MERCHANT-scope catalog rows — must exist before menu links and role grants. */
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
	readonly roleGrantRows: number;
}

async function upsertMerchantCapabilityDefinitions(): Promise<Map<CapabilitySlug, string>> {
	const now: number = Date.now();
	const slugToId = new Map<CapabilitySlug, string>();

	for (const entry of MERCHANT_CAPABILITY_CATALOG) {
		const row = await prisma.capabilityDefinition.upsert({
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
			select: { id: true, slug: true },
		});
		slugToId.set(entry.slug, row.id);
	}

	return slugToId;
}

async function syncMerchantRoleCapabilities(slugToId: ReadonlyMap<CapabilitySlug, string>): Promise<number> {
	const now: number = Date.now();
	let grantCount = 0;

	for (const role of MerchantMemberRoleSchema.options) {
		const desiredSlugs = DEFAULT_MERCHANT_ROLE_CAPABILITY_GRANTS[role as MerchantMemberRole];
		const desiredIds = new Set<string>();

		for (const slug of desiredSlugs) {
			const capabilityId = slugToId.get(slug);
			if (capabilityId === undefined) {
				continue;
			}
			desiredIds.add(capabilityId);

			await prisma.merchantRoleCapability.upsert({
				where: {
					role_capabilityId: {
						role,
						capabilityId,
					},
				},
				create: {
					role,
					capabilityId,
				},
				update: {
					isDeleted: false,
					deletedAt: null,
					updatedAt: now,
				},
			});
			grantCount += 1;
		}

		const existing = await prisma.merchantRoleCapability.findMany({
			where: { role },
			select: { id: true, capabilityId: true, isDeleted: true },
		});

		for (const row of existing) {
			if (!desiredIds.has(row.capabilityId) && !row.isDeleted) {
				await prisma.merchantRoleCapability.update({
					where: { id: row.id },
					data: { isDeleted: true, deletedAt: now, updatedAt: now },
				});
			}
		}
	}

	return grantCount;
}

/** Seeds MERCHANT capability catalog + default OWNER/CASHIER role grants. */
export async function seedMerchantCapabilities(): Promise<MerchantCapabilitySeedSummary> {
	const slugToId = await upsertMerchantCapabilityDefinitions();
	const roleGrantRows = await syncMerchantRoleCapabilities(slugToId);

	return {
		definitions: MERCHANT_CAPABILITY_CATALOG.length,
		roleGrantRows,
	};
}
