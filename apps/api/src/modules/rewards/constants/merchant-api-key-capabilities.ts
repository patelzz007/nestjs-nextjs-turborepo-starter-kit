import type { CapabilitySlug, OrganizationApiKeyScope } from "@workspace/shared";

/**
 * Cedar-backed organization capabilities each API key scope holds on the
 * organization API (`@AllowApiKeyAuth()` routes). No scope can manage keys,
 * terminals, the team, stores or business verification.
 *
 * - `POS` (every key a till receives by pairing): none — a till may only call
 *   the POS redemption routes, which `MerchantApiKeyGuard` authorizes.
 * - `INTEGRATION`: read rewards / redemptions / analytics and manage rewards.
 */
export const MERCHANT_API_KEY_SCOPE_CAPABILITIES: Readonly<Record<OrganizationApiKeyScope, readonly CapabilitySlug[]>> = {
	POS: [],
	INTEGRATION: ["merchant:view_rewards", "merchant:manage_rewards", "merchant:view_redemptions", "merchant:view_analytics"],
};
