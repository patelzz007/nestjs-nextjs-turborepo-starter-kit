import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readPaginatedHasNext, readPaginatedTotal, readPaginatedTotalPages } from "@/lib/api-envelope";

import SampleCategoryView from "./sample-category-view.generated";

export const dynamic = "force-dynamic";

export default async function SampleCategoryPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await Promise.allSettled([server.sampleCategory.list.query({ page: 1, limit: 20 })]);

	const first = result[0];
	const initialRows = first.status === "fulfilled" ? first.value.data : undefined;
	const initialTotal = first.status === "fulfilled" ? readPaginatedTotal(first.value.meta) : undefined;
	const initialTotalPages = first.status === "fulfilled" ? readPaginatedTotalPages(first.value.meta) : undefined;
	const initialHasNext = first.status === "fulfilled" ? readPaginatedHasNext(first.value.meta, false) : undefined;

	return <SampleCategoryView initialRows={initialRows} initialTotal={initialTotal} initialTotalPages={initialTotalPages} initialHasNext={initialHasNext} />;
}
