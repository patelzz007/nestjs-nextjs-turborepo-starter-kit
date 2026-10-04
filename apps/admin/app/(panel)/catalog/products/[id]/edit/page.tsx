import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readProductIdParam, type IdRouteParams } from "@/lib/catalog/route-params";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import { EditProductView } from "../../product-editor";

export const dynamic = "force-dynamic";

/**
 * `/catalog/products/[id]/edit` — edit a product (UPDATE PRODUCT, enforced by
 * the route guard; the API re-checks it). The product is prefetched so the
 * form opens pre-filled; a missing product renders the 404 page.
 */
export default async function EditProductPage(props: IdRouteParams): Promise<React.JSX.Element> {
	const id = await readProductIdParam(props);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/catalog/products/[id]/edit", resource: "product" }, () => server.product.detail.query({ id }));

	return <EditProductView id={id} initialProduct={resolvePrefetchedData(result)} />;
}
