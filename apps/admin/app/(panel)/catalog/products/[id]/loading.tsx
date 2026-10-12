import { CatalogDetailPageSkeleton, PRODUCT_DETAIL_SHAPE } from "@/components/loading/catalog-skeletons";
import { PRODUCT_LOADING_LABELS } from "@/components/loading/loading-labels";

/**
 * `/catalog/products/[id]` while the product is fetched — mirrors `ProductDetailView`.
 */
export default function ProductDetailLoading(): React.JSX.Element {
	return <CatalogDetailPageSkeleton labels={PRODUCT_LOADING_LABELS} shape={PRODUCT_DETAIL_SHAPE} />;
}
