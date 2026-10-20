import type { CapabilitySlug, TenantApiKeyScope } from "@workspace/shared";

/**
 * Tenant capabilities each API key scope holds on the tenant API (`@AllowApiKeyAuth()`
 * routes). No scope can manage keys, terminals, the team, stores or business verification.
 *
 * - `POS` (every key a till receives by pairing): none — a till may only call the POS redemption
 *   routes, which the till guard authorizes.
 * - `INTEGRATION`: read rewards / redemptions / analytics and manage rewards.
 */
export const API_KEY_SCOPE_CAPABILITIES: Readonly<Record<TenantApiKeyScope, readonly CapabilitySlug[]>> = {
	POS: [],
	INTEGRATION: ["merchant:view_rewards", "merchant:manage_rewards", "merchant:view_redemptions", "merchant:view_analytics"],
};
