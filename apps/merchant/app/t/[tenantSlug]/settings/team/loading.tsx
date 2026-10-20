import { MerchantTeamPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/settings/team` while the page guard runs. */
export default function MerchantTeamLoading(): React.JSX.Element {
	return <MerchantTeamPageSkeleton />;
}
