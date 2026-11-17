import { CUSTOMER_TIER_LABELS, type CustomerTier } from "@workspace/shared";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { Award, Lock } from "lucide-react";
import * as React from "react";

/** How each tier reads beside its name: Bronze quiet, Diamond the brightest (ADR 085). */
export const CUSTOMER_TIER_TONES: Readonly<Record<CustomerTier, StatusTone>> = { BRONZE: "muted", SILVER: "neutral", GOLD: "warning", DIAMOND: "info" };

export interface TierBadgeProps {
	readonly tier: CustomerTier;
	/** A reward's minimum tier the viewer has not reached: shown with a lock. */
	readonly locked?: boolean;
	readonly className?: string;
}

/** A customer's tier, or a reward's minimum tier ("Gold" / "Gold only" with a lock). The same badge in every web app. */
export function TierBadge({ tier, locked = false, className }: TierBadgeProps): React.JSX.Element {
	const Icon = locked ? Lock : Award;
	return (
		<StatusBadge tone={CUSTOMER_TIER_TONES[tier]} className={className}>
			<Icon aria-hidden className="size-3" />
			{locked ? `${CUSTOMER_TIER_LABELS[tier]} only` : CUSTOMER_TIER_LABELS[tier]}
		</StatusBadge>
	);
}
