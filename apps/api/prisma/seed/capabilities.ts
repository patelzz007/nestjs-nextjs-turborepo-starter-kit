import { prisma } from "./client";
import { MERCHANT_CAPABILITY_CATALOG } from "./merchant-capability-catalog";

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
