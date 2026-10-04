import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readProductIdParam, type IdRouteParams } from "@/lib/catalog/route-params";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import ProductDetailView from "../product-detail-view";

export const dynamic = "force-dynamic";

/** `/catalog/products/[id]` — one product (READ PRODUCT). A malformed id or a missing product renders the 404 page. */
export default async function ProductDetailPage(props: IdRouteParams): Promise<React.JSX.Element> {
	const id = await readProductIdParam(props);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/catalog/products/[id]", resource: "product" }, () => server.product.detail.query({ id }));

	return <ProductDetailView id={id} initialProduct={resolvePrefetchedData(result)} />;
}
