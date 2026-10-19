"use client";

import { RewardCard } from "@/contexts/rewards/components/browse/card";
import { eqFilter, listStateToListQuery } from "@workspace/client/lib/api/list-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { rewardListQuery, type RewardResponse } from "@workspace/shared";
import * as React from "react";

/** How many other offers the row shows (one more is fetched, in case the current offer is among them). */
const MORE_OFFERS_SHOWN = 3;

export interface RewardMoreFromMerchantProps {
	readonly reward: RewardResponse;
	/** Where the cards link (the public or the signed-in detail page). */
	readonly detailPathPrefix: string;
}

/** The merchant's other live offers, soonest-ending first — hidden when there are none. */
export function RewardMoreFromMerchant({ reward, detailPathPrefix }: RewardMoreFromMerchantProps): React.JSX.Element | null {
	const { api } = useAuth();
	const query = api.rewards.list.useQuery(
		listStateToListQuery(rewardListQuery, {
			pagination: { page: 1, limit: MORE_OFFERS_SHOWN + 1 },
			sort: "expiryDate",
			filter: { organizationId: eqFilter(reward.organizationId) },
		}),
	);
	const others = (query.data?.data ?? []).filter((other) => other.id !== reward.id).slice(0, MORE_OFFERS_SHOWN);

	if (others.length === 0) {
		return null;
	}
	return (
		<section aria-labelledby="reward-more-from-merchant" className="space-y-4">
			<h2 id="reward-more-from-merchant" className="text-lg font-semibold tracking-tight">
				{reward.organizationName === undefined ? "More from this merchant" : `More from ${reward.organizationName}`}
			</h2>
			<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{others.map((other) => (
					<li key={other.id}>
						<RewardCard reward={other} detailPathPrefix={detailPathPrefix} />
					</li>
				))}
			</ul>
		</section>
	);
}
