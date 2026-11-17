// Locked rewards on the web (ADR 085): a reward whose minimum tier is above the viewer's tier is shown as a teaser —
// marked, never claimable. The viewer's tier comes from `GET /tiers/availability` (Bronze when signed out); while
// tiers are off there is no viewer tier and nothing is locked or marked.

import { ENTRY_CUSTOMER_TIER, isTierAtLeast, type CustomerTier, type RewardResponse, type TierAvailability } from "@workspace/shared";

/** The viewer's tier while tiers are on; `null` while they are off or the availability could not be read. */
export function viewerTierOf(availability: TierAvailability | undefined): CustomerTier | null {
	return availability?.enabled === true ? availability.viewerTier : null;
}

/** Whether `reward` asks for more than `viewerTier` reaches. Never while tiers are off. */
export function isRewardLockedFor(reward: Pick<RewardResponse, "minimumTier">, viewerTier: CustomerTier | null): boolean {
	return viewerTier !== null && !isTierAtLeast(viewerTier, reward.minimumTier);
}

/** Whether a reward carries a tier mark at all: tiers are on and it asks for more than the entry tier. */
export function hasTierMark(reward: Pick<RewardResponse, "minimumTier">, viewerTier: CustomerTier | null): boolean {
	return viewerTier !== null && reward.minimumTier !== ENTRY_CUSTOMER_TIER;
}
