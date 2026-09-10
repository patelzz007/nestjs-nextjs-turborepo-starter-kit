import type { CapabilitySlug } from "@workspace/shared";

import { DEFAULT_MERCHANT_ROLE_CAPABILITY_GRANTS } from "./merchant-role-capability-defaults";

/**
 * Capabilities granted to merchant API keys.
 * Keys cannot manage other API keys — that remains a dashboard-only action.
 */
export const MERCHANT_API_KEY_CAPABILITIES: readonly CapabilitySlug[] = DEFAULT_MERCHANT_ROLE_CAPABILITY_GRANTS.OWNER.filter(
	(capability) => capability !== "merchant:manage_api_keys",
);
