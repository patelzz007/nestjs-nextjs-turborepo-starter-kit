import { MerchantBrandingPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/settings/branding` while the page guard runs. */
export default function MerchantBrandingLoading(): React.JSX.Element {
	return <MerchantBrandingPageSkeleton />;
}
