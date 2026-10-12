import { MerchantTerminalsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/terminals` while the server prefetches the tills and the policy. */
export default function MerchantTerminalsLoading(): React.JSX.Element {
	return <MerchantTerminalsPageSkeleton />;
}
