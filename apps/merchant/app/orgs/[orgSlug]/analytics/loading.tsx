import { MerchantAnalyticsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/analytics` while the server prefetches the dashboard for the range in the URL. */
export default function MerchantAnalyticsLoading(): React.JSX.Element {
	return <MerchantAnalyticsPageSkeleton />;
}
