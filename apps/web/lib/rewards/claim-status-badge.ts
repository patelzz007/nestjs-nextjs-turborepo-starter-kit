import type { StatusTone } from "@workspace/ui/components/status-badge";
import type { RewardClaimStatus } from "@workspace/shared";

import { CLAIM_STATUS_DISPLAY } from "./customer-analytics";

/** How a claim's status reads as a badge: the shared status label, and what the status means. */
export interface ClaimStatusBadge {
	readonly label: string;
	readonly tone: StatusTone;
}

/**
 * A claim the holder can still show at checkout is the one state worth
 * drawing the eye (`success`). A redeemed claim is settled (`neutral`); an
 * expired one recedes (`muted`). The label is the one vocabulary the wallet
 * and the activity charts share (`CLAIM_STATUS_DISPLAY`).
 */
const CLAIM_STATUS_TONE: Readonly<Record<RewardClaimStatus, StatusTone>> = {
	PENDING: "success",
	REDEEMED: "neutral",
	EXPIRED: "muted",
};

export function claimStatusBadge(status: RewardClaimStatus): ClaimStatusBadge {
	return { label: CLAIM_STATUS_DISPLAY[status].label, tone: CLAIM_STATUS_TONE[status] };
}
