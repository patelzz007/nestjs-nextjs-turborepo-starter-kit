"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { CUSTOMER_TIER_LABELS } from "@workspace/shared";
import Link from "next/link";
import * as React from "react";

import { TierBadge } from "@workspace/client/lib/contexts/tiers";
import { viewerTierOf } from "@/contexts/tiers/lib/reward-tier-lock";
import { ROUTES } from "@/lib/routes";

/** How long the customer's tier in the header is reused before it is read again. */
const TIER_STALE_TIME_MS = 60_000;

/**
 * The signed-in customer's tier in the dashboard header, linking to their tier page (ADR 085). Nothing while tiers are
 * off or the tier is still being read — the header never shows a placeholder tier.
 */
export function TopbarTierBadge(): React.JSX.Element | null {
	const { api } = useAuth();
	const availability = api.tiers.availability.useQuery(undefined, { staleTime: TIER_STALE_TIME_MS });
	const tier = viewerTierOf(availability.data?.data);
	if (tier === null) {
		return null;
	}
	return (
		<Link
			href={ROUTES.dashboard.tier}
			aria-label={`Your tier: ${CUSTOMER_TIER_LABELS[tier]}. See your tier`}
			className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
			<TierBadge tier={tier} />
		</Link>
	);
}
