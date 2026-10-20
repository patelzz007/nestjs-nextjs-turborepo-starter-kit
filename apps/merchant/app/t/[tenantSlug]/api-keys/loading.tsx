import { MerchantApiKeysPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/api-keys` while the server prefetches the key list and its counts. */
export default function MerchantApiKeysLoading(): React.JSX.Element {
	return <MerchantApiKeysPageSkeleton />;
}
