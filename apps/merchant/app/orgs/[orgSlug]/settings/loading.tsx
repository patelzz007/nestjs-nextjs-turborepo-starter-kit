import { MerchantSettingsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/settings` while the page guard runs. */
export default function MerchantSettingsLoading(): React.JSX.Element {
	return <MerchantSettingsPageSkeleton />;
}
