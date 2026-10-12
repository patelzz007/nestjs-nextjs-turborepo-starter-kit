import { PendingRewardsPageSkeleton } from "@/components/loading/rewards-skeletons";

/**
 * `/rewards` redirects to the moderation queue, so it waits in that page's shape.
 */
export default function RewardsLoading(): React.JSX.Element {
	return <PendingRewardsPageSkeleton />;
}
