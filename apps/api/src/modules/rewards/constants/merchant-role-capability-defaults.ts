import type { MerchantMemberRole } from "@prisma/client";
import type { CapabilitySlug } from "@workspace/shared";

/**
 * Bootstrap grants for `merchant_role_capabilities` — used only when seeding an empty table
 * or restoring defaults from admin. Runtime authorization always reads from the database.
 */
export const DEFAULT_MERCHANT_ROLE_CAPABILITY_GRANTS: Record<MerchantMemberRole, readonly CapabilitySlug[]> = {
	OWNER: [
		"merchant:view_dashboard",
		"merchant:view_analytics",
		"merchant:view_rewards",
		"merchant:manage_rewards",
		"merchant:view_redemptions",
		"merchant:manage_api_keys",
	],
	CASHIER: ["merchant:view_dashboard", "merchant:view_analytics", "merchant:view_rewards", "merchant:view_redemptions"],
};
