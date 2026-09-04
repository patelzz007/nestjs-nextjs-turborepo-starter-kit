import type { MerchantMemberRole } from "@prisma/client";
import type { MerchantCapability } from "@workspace/shared";

import { prisma } from "./client";

/** Default grants — runtime reads from `merchant_role_capabilities` after seed. */
const DEFAULT_MERCHANT_ROLE_CAPABILITIES: Record<MerchantMemberRole, readonly MerchantCapability[]> = {
	OWNER: ["merchant:view_dashboard", "merchant:view_analytics", "merchant:view_rewards", "merchant:manage_rewards", "merchant:view_redemptions", "merchant:manage_api_keys"],
	CASHIER: ["merchant:view_dashboard", "merchant:view_analytics", "merchant:view_rewards", "merchant:view_redemptions"],
};

export async function seedMerchantRoleCapabilities(): Promise<void> {
	for (const [role, capabilities] of Object.entries(DEFAULT_MERCHANT_ROLE_CAPABILITIES) as [MerchantMemberRole, readonly MerchantCapability[]][]) {
		for (const capability of capabilities) {
			await prisma.merchantRoleCapability.upsert({
				where: {
					role_capability: {
						role,
						capability,
					},
				},
				update: {
					isDeleted: false,
					deletedAt: null,
				},
				create: {
					role,
					capability,
				},
			});
		}
	}
}
