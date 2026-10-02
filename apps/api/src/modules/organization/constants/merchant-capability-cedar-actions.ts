import type { MerchantCapability } from "@workspace/shared";

/**
 * Tenant Cedar action evaluated after the membership-role table for each
 * merchant capability (Cedar may only narrow the role table).
 *
 * `null` marks a capability that is satisfied by organization membership
 * itself: the dashboard and the store locations list come from the
 * member-wide `GET /orgs/:orgSlug/context`, and any member may read store
 * branding files (`FileAuthorizationService` checks the role table alone).
 * Asking `requireMembershipCapability` to enforce one of those fails closed
 * (unknown capability).
 *
 * A `Record` (not `Partial`) so adding a capability to the shared vocabulary
 * fails to compile until it is mapped here.
 */
export const MERCHANT_CAPABILITY_CEDAR_ACTIONS: Readonly<Record<MerchantCapability, string | null>> = {
	"merchant:view_dashboard": null,
	"merchant:view_rewards": "rewardhub:view_rewards",
	"merchant:manage_rewards": "rewardhub:manage_rewards",
	"merchant:view_redemptions": "rewardhub:view_redemptions",
	"merchant:manage_api_keys": "rewardhub:manage_api_keys",
	"merchant:view_analytics": "rewardhub:view_analytics",
	"merchant:manage_team": "rewardhub:manage_team",
	"merchant:view_locations": null,
	"merchant:manage_locations": "rewardhub:manage_locations",
	"merchant:manage_verification": "rewardhub:manage_verification",
};
