import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readCategoryIdParam, type IdRouteParams } from "@/lib/catalog/route-params";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import SampleCategoryDetailView from "../sample-category-detail-view";

export const dynamic = "force-dynamic";

/** `/catalog/categories/[id]` — one category (READ SAMPLE_CATEGORY). A malformed id or a missing category renders the 404 page. */
export default async function CategoryDetailPage(props: IdRouteParams): Promise<React.JSX.Element> {
	const id = await readCategoryIdParam(props);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/catalog/categories/[id]", resource: "category" }, () => server.sampleCategory.detail.query({ id }));

	return <SampleCategoryDetailView id={id} initialSampleCategory={resolvePrefetchedData(result)} />;
}
