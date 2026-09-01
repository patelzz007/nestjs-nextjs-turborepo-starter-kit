import { LandingShell } from "@/components/landing/landing-shell";
import { RewardDetailView } from "@/components/rewardhub/reward-detail-view";
import { createWebServerCaller } from "@/lib/web-server-api";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import type { RewardResponse } from "@workspace/shared";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export const dynamic = "force-dynamic";

export default async function PublicRewardDetailPage({ params }: { readonly params: Promise<{ rewardId: string }> }): Promise<React.JSX.Element> {
	const { rewardId } = await params;
	const server = createWebServerCaller();

	let initialReward: RewardResponse | undefined;
	try {
		const response = await server.rewards.detail.query({ rewardId });
		initialReward = response.data;
	} catch {
		initialReward = undefined;
	}

	return (
		<LandingShell>
			<div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
				<Link href="/#rewards" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6 -ml-2 gap-1.5")}>
					<ArrowLeft className="size-4" aria-hidden="true" />
					Back to offers
				</Link>
				<RewardDetailView rewardId={rewardId} initialReward={initialReward} />
			</div>
		</LandingShell>
	);
}
