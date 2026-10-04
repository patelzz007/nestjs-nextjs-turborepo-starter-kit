import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedQuery } from "@/lib/server/prefetch";
import { PRODUCTS_TABLE_URL_STATE, toProductsListQuery } from "@/lib/url-state/products";

import ProductView from "./product-view";

export const dynamic = "force-dynamic";

/** `/catalog/products` — parses the table's URL state and prefetches that exact page. */
export default async function ProductPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = PRODUCTS_TABLE_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/catalog/products", resource: "products" }, () => server.product.list.query(toProductsListQuery(urlState)));

	return <ProductView initialPage={resolvePrefetchedQuery(PRODUCTS_TABLE_URL_STATE.serialize(urlState), result)} />;
}
