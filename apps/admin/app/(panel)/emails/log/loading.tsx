import { EMAIL_LOG_LOADING_LABELS } from "@/components/loading/loading-labels";
import { EMAIL_LOG_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";

/**
 * `/emails/log` while the page of sends is fetched — mirrors `EmailLogView`.
 */
export default function EmailLogLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={EMAIL_LOG_LOADING_LABELS} shape={EMAIL_LOG_TABLE_PAGE} />;
}
