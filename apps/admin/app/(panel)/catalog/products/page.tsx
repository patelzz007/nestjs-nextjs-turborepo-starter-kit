import { createAdminServerCaller } from "@/lib/admin-server-api";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { PRODUCTS_TABLE_URL_STATE, toProductsListQuery } from "@/lib/url-state/products";

import ProductView from "./product-view";

export const dynamic = "force-dynamic";

/** `/catalog/products` — parses the table's URL state and prefetches that exact page. */
export default async function ProductPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = PRODUCTS_TABLE_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const [result] = await Promise.allSettled([server.product.list.query(toProductsListQuery(urlState))]);

	return <ProductView initialPage={toPrefetchedQuery(PRODUCTS_TABLE_URL_STATE.serialize(urlState), result)} />;
}
