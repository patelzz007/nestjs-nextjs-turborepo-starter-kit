import { MerchantAccountPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/account` while the page guard runs. */
export default function MerchantAccountLoading(): React.JSX.Element {
	return <MerchantAccountPageSkeleton />;
}
