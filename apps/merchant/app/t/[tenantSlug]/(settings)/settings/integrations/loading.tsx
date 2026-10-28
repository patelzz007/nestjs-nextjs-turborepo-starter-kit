import { MerchantIntegrationsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/settings/integrations` while the page guard runs. */
export default function MerchantIntegrationsLoading(): React.JSX.Element {
	return <MerchantIntegrationsPageSkeleton />;
}
