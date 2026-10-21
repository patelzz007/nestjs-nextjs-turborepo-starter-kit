import { SUPPORT_ACCESS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { SUPPORT_ACCESS_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";

/** `/users/support-access` while the page of grants is fetched — the page header over `SupportAccessConsole`. */
export default function SupportAccessLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={SUPPORT_ACCESS_LOADING_LABELS} shape={SUPPORT_ACCESS_TABLE_PAGE} />;
}
