import { CatalogEditorPageSkeleton, PRODUCT_FORM_SHAPE } from "@/components/loading/catalog-skeletons";
import { PRODUCT_LOADING_LABELS } from "@/components/loading/loading-labels";

/**
 * `/catalog/products/[id]/edit` while the product is fetched — mirrors `EditProductView`.
 */
export default function EditProductLoading(): React.JSX.Element {
	return <CatalogEditorPageSkeleton labels={PRODUCT_LOADING_LABELS} shape={PRODUCT_FORM_SHAPE} />;
}
