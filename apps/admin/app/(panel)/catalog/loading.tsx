import { PRODUCTS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { PRODUCTS_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";

/**
 * `/catalog` redirects to the products list, so it waits in that list's shape.
 */
export default function CatalogLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={PRODUCTS_LOADING_LABELS} shape={PRODUCTS_TABLE_PAGE} />;
}
