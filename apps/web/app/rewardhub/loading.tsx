import { RewardHubBrowseSkeleton } from "@/components/loading/reward-hub-browse-skeleton";
import * as React from "react";

/**
 * `/rewardhub` (browse) while the server prefetches the catalog page. The
 * shell in `layout.tsx` stays mounted; this fills the content area only.
 * Every child route has its own `loading.tsx`, so this shape never stands in
 * for a page it does not resemble.
 */
export default function RewardHubBrowseLoading(): React.JSX.Element {
	return <RewardHubBrowseSkeleton />;
}
