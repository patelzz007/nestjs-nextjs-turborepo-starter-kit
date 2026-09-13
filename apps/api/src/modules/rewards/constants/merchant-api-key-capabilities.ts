import type { CapabilitySlug } from "@workspace/shared";

/** Cedar-backed capabilities allowed for organization POS API keys (no key management). */
export const MERCHANT_API_KEY_CAPABILITIES: readonly CapabilitySlug[] = [
	"merchant:view_rewards",
	"merchant:manage_rewards",
	"merchant:view_redemptions",
	"merchant:view_analytics",
];
