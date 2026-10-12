import { PRODUCTS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { PRODUCTS_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";

/**
 * `/catalog/products` while the page of products is fetched — mirrors `ProductView`.
 */
export default function ProductsLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={PRODUCTS_LOADING_LABELS} shape={PRODUCTS_TABLE_PAGE} />;
}
