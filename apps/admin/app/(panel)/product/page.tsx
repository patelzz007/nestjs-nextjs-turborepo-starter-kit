import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readPaginatedTotal } from "@/lib/api-envelope";

import ProductView from "./product-view.generated";

export const dynamic = "force-dynamic";

export default async function ProductPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await Promise.allSettled([server.product.list.query({ page: 1, limit: 20 })]);

	const first = result[0];
	const initialRows = first.status === "fulfilled" ? first.value.data : undefined;
	const initialTotal = first.status === "fulfilled" ? readPaginatedTotal(first.value.meta, first.value.data.length) : undefined;

	return <ProductView initialRows={initialRows} initialTotal={initialTotal} />;
}
