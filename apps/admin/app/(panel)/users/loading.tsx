import { USERS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { TablePageSkeleton, USERS_TABLE_PAGE } from "@/components/loading/table-page-skeleton";

/**
 * `/users` while the page of users is fetched — mirrors `UsersAllTable`.
 */
export default function UsersLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={USERS_LOADING_LABELS} shape={USERS_TABLE_PAGE} />;
}
