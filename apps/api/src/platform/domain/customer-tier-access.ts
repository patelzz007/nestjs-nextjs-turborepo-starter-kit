import { isTierAtLeast, type CustomerTier } from "@workspace/shared";

/**
 * What a context that gates on tiers (ADR 085) knows about one viewer: tiers are off for the deployment (the
 * `customer-tiers` flag), so every reward is open to everyone; or they are on, and this is the viewer's tier (a
 * signed-out visitor is Bronze).
 */
export type CustomerTierAccess = { readonly kind: "off" } | { readonly kind: "on"; readonly tier: CustomerTier };

/** Whether a viewer with `access` may claim a reward whose minimum tier is `minimumTier`. */
export function reachesMinimumTier(access: CustomerTierAccess, minimumTier: CustomerTier): boolean {
	return access.kind === "off" || isTierAtLeast(access.tier, minimumTier);
}
