"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { TierBadge, useTiersEnabled } from "@workspace/client/lib/contexts/tiers";
import { CUSTOMER_TIER_LABELS, type AdminUserTier, type CustomerTierChange } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import * as React from "react";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "Moved up to Gold" / "Moved down to Silver". */
export function tierChangeLine(change: Pick<CustomerTierChange, "reason" | "toTier">): string {
	return `${change.reason === "PROMOTION" ? "Moved up" : "Moved down"} to ${CUSTOMER_TIER_LABELS[change.toTier]}`;
}

/**
 * A customer's tier on their admin page (ADR 085): read-only — staff never set a tier by hand. Their counted
 * redemptions, any hold or pending warning, when they were last evaluated, and their tier history. Nothing while
 * tiers are off.
 */
export function UserTierCard({ userId }: { readonly userId: string }): React.JSX.Element | null {
	const { api } = useAuth();
	const tiersEnabled = useTiersEnabled();
	const query = api.tiers.userTier.useQuery({ userId }, { enabled: tiersEnabled });
	if (!tiersEnabled) {
		return null;
	}
	const tier = query.data?.data;
	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle className="text-lg">Customer tier</CardTitle>
					{tier === undefined ? null : <TierBadge tier={tier.tier} />}
				</div>
				<CardDescription>Earned from redemptions; the nightly review keeps it current. Read-only.</CardDescription>
			</CardHeader>
			<CardContent>{tier === undefined ? <Skeleton className="h-24 w-full" /> : <UserTierDetails tier={tier} />}</CardContent>
		</Card>
	);
}

function UserTierDetails({ tier }: { readonly tier: AdminUserTier }): React.JSX.Element {
	return (
		<div className="flex flex-col gap-4">
			<dl className="grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
				<dt className="text-muted-foreground">Counted redemptions</dt>
				<dd className="tabular-nums">{String(tier.countedRedemptions)}</dd>
				<dt className="text-muted-foreground">Tier hold</dt>
				<dd>{tier.holdUntil === null ? "None" : `Until ${DATE.format(tier.holdUntil)}`}</dd>
				<dt className="text-muted-foreground">Pending demotion</dt>
				<dd>
					{tier.demotionWarning === null
						? "None"
						: `To ${CUSTOMER_TIER_LABELS[tier.demotionWarning.toTier]} on ${DATE.format(tier.demotionWarning.dueAt)} unless they redeem ${String(tier.demotionWarning.redemptionsToKeep)} more`}
				</dd>
				<dt className="text-muted-foreground">Last evaluated</dt>
				<dd>{tier.evaluatedAt === null ? "Never (Bronze)" : DATE.format(tier.evaluatedAt)}</dd>
			</dl>
			<section aria-label="Tier history" className="flex flex-col gap-2">
				<h3 className="text-sm font-medium">Tier history</h3>
				{tier.history.length === 0 ? (
					<p className="text-sm text-muted-foreground">No changes yet.</p>
				) : (
					<ul className="flex flex-col divide-y divide-border text-sm">
						{tier.history.map((change) => (
							<li key={change.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
								<span>
									{tierChangeLine(change)} <span className="text-muted-foreground">({String(change.countedRedemptions)} counted)</span>
								</span>
								<span className="text-muted-foreground">{DATE.format(change.occurredAt)}</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
