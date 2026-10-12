import { CatalogEditorPageSkeleton, PRODUCT_FORM_SHAPE } from "@/components/loading/catalog-skeletons";
import { NEW_PRODUCT_LOADING_LABELS } from "@/components/loading/loading-labels";

/**
 * `/catalog/products/new` while it streams in — mirrors `CreateProductView`.
 */
export default function NewProductLoading(): React.JSX.Element {
	return <CatalogEditorPageSkeleton labels={NEW_PRODUCT_LOADING_LABELS} shape={PRODUCT_FORM_SHAPE} />;
}
