import { MERCHANTS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { MERCHANTS_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";

/**
 * `/merchants` while the page of tenants is fetched — mirrors `MerchantsAllTable`.
 */
export default function MerchantsLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={MERCHANTS_LOADING_LABELS} shape={MERCHANTS_TABLE_PAGE} />;
}
