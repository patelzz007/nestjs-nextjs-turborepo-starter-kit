import { CATEGORY_FORM_SHAPE, CatalogEditorPageSkeleton } from "@/components/loading/catalog-skeletons";
import { NEW_CATEGORY_LOADING_LABELS } from "@/components/loading/loading-labels";

/**
 * `/catalog/categories/new` while it streams in — mirrors `CreateCategoryView`.
 */
export default function NewCategoryLoading(): React.JSX.Element {
	return <CatalogEditorPageSkeleton labels={NEW_CATEGORY_LOADING_LABELS} shape={CATEGORY_FORM_SHAPE} />;
}
