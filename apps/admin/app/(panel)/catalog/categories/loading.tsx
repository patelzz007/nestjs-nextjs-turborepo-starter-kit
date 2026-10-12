import { CATEGORIES_LOADING_LABELS } from "@/components/loading/loading-labels";
import { CATEGORIES_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";

/**
 * `/catalog/categories` while the page of categories is fetched — mirrors `SampleCategoryView`.
 */
export default function CategoriesLoading(): React.JSX.Element {
	return <TablePageSkeleton labels={CATEGORIES_LOADING_LABELS} shape={CATEGORIES_TABLE_PAGE} />;
}
