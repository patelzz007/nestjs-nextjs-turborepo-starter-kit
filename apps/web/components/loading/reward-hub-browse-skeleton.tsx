"use client";

import { REWARDS_CATALOG_LOADING_LABELS } from "@/components/loading/loading-labels";
import { RewardBrowseBones } from "@/components/loading/reward-catalog-skeleton";
import { useRewardsViewMode } from "@workspace/client/lib/features/ui-preferences/facade";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import * as React from "react";

/**
 * `/rewardhub` while the server prefetches the catalog page. Reads the
 * visitor's saved grid/list layout, so the bones take the shape the catalog
 * is about to render in.
 */
export function RewardHubBrowseSkeleton(): React.JSX.Element {
	const viewMode = useRewardsViewMode();
	return (
		<SkeletonRegion labels={REWARDS_CATALOG_LOADING_LABELS}>
			<RewardBrowseBones variant="dashboard" viewMode={viewMode} />
		</SkeletonRegion>
	);
}
