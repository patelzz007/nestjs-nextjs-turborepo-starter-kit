import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedQuery } from "@/lib/server/prefetch";
import { CATEGORIES_TABLE_URL_STATE, toCategoriesListQuery } from "@/lib/url-state/categories";

import SampleCategoryView from "./sample-category-view";

export const dynamic = "force-dynamic";

/** `/catalog/categories` — parses the table's URL state and prefetches that exact page. */
export default async function SampleCategoryPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const urlState = CATEGORIES_TABLE_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/catalog/categories", resource: "categories" }, () => server.sampleCategory.list.query(toCategoriesListQuery(urlState)));

	return <SampleCategoryView initialPage={resolvePrefetchedQuery(CATEGORIES_TABLE_URL_STATE.serialize(urlState), result)} />;
}
