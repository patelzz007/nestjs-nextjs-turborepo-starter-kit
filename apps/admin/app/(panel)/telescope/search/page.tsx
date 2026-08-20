import { TelescopeSearchQuerySchema, type TelescopeSearchResponse } from "@workspace/shared";
import type { Envelope } from "@workspace/shared";

import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeSearchView from "./search-results";

export const dynamic = "force-dynamic";

/**
 * `/telescope/search` — global free-text search. Prefetches results server-side
 * only when `?q=` is present and non-empty (the client disables its query
 * otherwise); the empty box renders its idle state with no API call.
 */
export default async function TelescopeSearchPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const sp = await searchParams;
	const rawQ: string | undefined = typeof sp.q === "string" ? sp.q : undefined;
	const q: string = rawQ?.trim() ?? "";
	const hasQuery: boolean = q.length > 0;

	let searchData: Envelope<TelescopeSearchResponse> | undefined;
	if (hasQuery) {
		const parsed = TelescopeSearchQuerySchema.safeParse({ q, limit: 10 });
		if (parsed.success) {
			const server = createServerCaller();
			searchData = await server.telescope.search.query(parsed.data);
		}
	}

	return <TelescopeSearchView initialSearchData={searchData} />;
}
