"use client";

import { RewardVoucher } from "@/contexts/rewards/components/reward-voucher";
import { useOrganizationPath } from "@/contexts/organizations";
import { describeRewardStores, formatRewardEnd, isRewardEnded } from "@/contexts/rewards/lib/presentation";
import { formatRewardOffer } from "@workspace/client/lib/contexts/rewards/reward-offer";
import { ORG_ROUTES } from "@/lib/routes";
import type { RewardResponse } from "@workspace/shared";
import Link from "next/link";
import * as React from "react";

export interface MerchantRewardCardProps {
	readonly reward: RewardResponse;
	readonly canManageRewards: boolean;
}

/** How wide a card's cover is drawn: a third of the catalog on wide screens, half on tablets, full width on phones. */
const CARD_COVER_SIZES = "(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw";

/** Grid tile for a merchant reward: the reward's voucher, whose title link stretches over the whole card to open the reward. */
export function MerchantRewardCard({ reward, canManageRewards }: MerchantRewardCardProps): React.JSX.Element {
	const rewardPath = useOrganizationPath(ORG_ROUTES.rewards.detail(reward.id));
	const [cover] = reward.images;

	return (
		<RewardVoucher
			cover={cover}
			coverSizes={CARD_COVER_SIZES}
			category={
				<>
					{reward.category}
					{reward.rewardKind === "REFERRER" ? <span className="normal-case"> referral reward</span> : null}
				</>
			}
			status={reward.status}
			offer={formatRewardOffer(reward.rewardType, reward.rewardValue)}
			title={
				<Link href={rewardPath} className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']">
					{reward.title}
					<span className="sr-only">{canManageRewards ? ", manage reward" : ", view reward"}</span>
				</Link>
			}
			description={reward.description}
			remaining={reward.quantityRemaining}
			total={reward.quantityTotal}
			claimCount={reward.claimCount}
			redemptionCount={reward.redemptionCount}
			stores={describeRewardStores(reward)}
			endLabel={formatRewardEnd(reward)}
			ended={isRewardEnded(reward.status)}
		/>
	);
}
