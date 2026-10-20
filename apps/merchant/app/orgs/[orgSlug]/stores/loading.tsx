import { MerchantStoresPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/stores` while the page renders. */
export default function MerchantStoresLoading(): React.JSX.Element {
	return <MerchantStoresPageSkeleton />;
}
