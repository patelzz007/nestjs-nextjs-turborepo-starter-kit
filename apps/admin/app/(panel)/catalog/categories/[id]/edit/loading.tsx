import { CATEGORY_FORM_SHAPE, CatalogEditorPageSkeleton } from "@/components/loading/catalog-skeletons";
import { CATEGORY_LOADING_LABELS } from "@/components/loading/loading-labels";

/**
 * `/catalog/categories/[id]/edit` while the category is fetched — mirrors `EditCategoryView`.
 */
export default function EditCategoryLoading(): React.JSX.Element {
	return <CatalogEditorPageSkeleton labels={CATEGORY_LOADING_LABELS} shape={CATEGORY_FORM_SHAPE} />;
}
