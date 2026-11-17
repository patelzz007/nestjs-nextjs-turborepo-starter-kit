// What a locked reward's detail page says where the Claim button would be (ADR 085).

import { CUSTOMER_TIER_LABELS, tierThreshold, type CustomerTier, type MyTier } from "@workspace/shared";

/** Who is looking at a locked reward: a signed-out visitor (Bronze), or a customer, with their tier page once it is read. */
export type LockedRewardViewer =
	| { readonly kind: "signed-out" }
	| { readonly kind: "signed-in"; readonly tier: CustomerTier; readonly page: Pick<MyTier, "countedRedemptions" | "rules"> | null };

/** How many more counted redemptions reach `minimumTier`, from the customer's tier page. */
export function redemptionsToUnlock(minimumTier: CustomerTier, page: Pick<MyTier, "countedRedemptions" | "rules">): number {
	return Math.max(0, tierThreshold(page.rules, minimumTier) - page.countedRedemptions);
}

/** "A Gold reward. You're Silver: 3 more redemptions to unlock it." — or the signed-out line. */
export function lockedRewardMessage(minimumTier: CustomerTier, viewer: LockedRewardViewer): string {
	const reward = `A ${CUSTOMER_TIER_LABELS[minimumTier]} reward.`;
	if (viewer.kind === "signed-out") {
		return `${reward} Sign in to see your tier.`;
	}
	const you = `You're ${CUSTOMER_TIER_LABELS[viewer.tier]}`;
	if (viewer.page === null) {
		return `${reward} ${you}.`;
	}
	const count = redemptionsToUnlock(minimumTier, viewer.page);
	return `${reward} ${you}: ${String(count)} more ${count === 1 ? "redemption" : "redemptions"} to unlock it.`;
}
