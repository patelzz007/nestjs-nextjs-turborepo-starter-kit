import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readCategoryIdParam, type IdRouteParams } from "@/lib/catalog/route-params";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import { EditCategoryView } from "../../category-editor";

export const dynamic = "force-dynamic";

/** `/catalog/categories/[id]/edit` — edit a category (UPDATE SAMPLE_CATEGORY, enforced by the route guard and the API). */
export default async function EditCategoryPage(props: IdRouteParams): Promise<React.JSX.Element> {
	const id = await readCategoryIdParam(props);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/catalog/categories/[id]/edit", resource: "category" }, () => server.sampleCategory.detail.query({ id }));

	return <EditCategoryView id={id} initialCategory={resolvePrefetchedData(result)} />;
}
