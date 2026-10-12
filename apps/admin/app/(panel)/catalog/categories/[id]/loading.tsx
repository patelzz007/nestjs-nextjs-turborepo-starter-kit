import { CATEGORY_DETAIL_SHAPE, CatalogDetailPageSkeleton } from "@/components/loading/catalog-skeletons";
import { CATEGORY_LOADING_LABELS } from "@/components/loading/loading-labels";

/**
 * `/catalog/categories/[id]` while the category is fetched — mirrors `SampleCategoryDetailView`.
 */
export default function CategoryDetailLoading(): React.JSX.Element {
	return <CatalogDetailPageSkeleton labels={CATEGORY_LOADING_LABELS} shape={CATEGORY_DETAIL_SHAPE} />;
}
