import { MerchantRedemptionsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/redemptions` while the server prefetches the page of the log and today's count. */
export default function MerchantRedemptionsLoading(): React.JSX.Element {
	return <MerchantRedemptionsPageSkeleton />;
}
