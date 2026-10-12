import { PendingRewardsPageSkeleton } from "@/components/loading/rewards-skeletons";

/**
 * `/rewards/review` while the page of pending rewards is fetched — mirrors `PendingRewardsPanel`.
 */
export default function RewardsReviewLoading(): React.JSX.Element {
	return <PendingRewardsPageSkeleton />;
}
