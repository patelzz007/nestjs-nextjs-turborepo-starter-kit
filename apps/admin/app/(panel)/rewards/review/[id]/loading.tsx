import { RewardReviewDetailPageSkeleton } from "@/components/loading/rewards-skeletons";

/**
 * `/rewards/review/[id]` while the reward is fetched — mirrors `RewardReviewDetailView`.
 */
export default function RewardReviewDetailLoading(): React.JSX.Element {
	return <RewardReviewDetailPageSkeleton />;
}
