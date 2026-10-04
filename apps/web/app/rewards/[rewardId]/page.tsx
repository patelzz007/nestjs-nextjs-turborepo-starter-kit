import { LandingShell } from "@/components/landing/landing-shell";
import { RewardDetailView } from "@/components/rewardhub/detail/view";
import { landingSectionPath, LANDING_SECTION_IDS } from "@/lib/routes";
import { loadRewardDetail } from "@/lib/rewards/reward-detail-server";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export const dynamic = "force-dynamic";

/** `/rewards/[rewardId]` — public (guest-browsable) reward detail; claiming asks the visitor to sign in. */
export default async function PublicRewardDetailPage({ params }: { readonly params: Promise<{ rewardId: string }> }): Promise<React.JSX.Element> {
	const { rewardId } = await params;
	const reward = await loadRewardDetail(rewardId);

	return (
		<LandingShell>
			<div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
				<Link href={landingSectionPath(LANDING_SECTION_IDS.rewards)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6 -ml-2 gap-1.5")}>
					<ArrowLeft className="size-4" aria-hidden="true" />
					Back to offers
				</Link>
				<RewardDetailView rewardId={reward.data.id} initialReward={reward} />
			</div>
		</LandingShell>
	);
}
