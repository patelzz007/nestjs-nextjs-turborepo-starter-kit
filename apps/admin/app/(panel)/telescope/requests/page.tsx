import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";
import { TelescopeRequestListQuerySchema, type TelescopeRequestListQuery } from "@workspace/shared";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeRequestsView from "./requests-table";

export const dynamic = "force-dynamic";

/**
 * `/telescope/requests` — the request log table. Server component: reconstructs
 * the same first-page query the client derives from `?method=&status=&min=&…`
 * (the client also consults localStorage table prefs, which the server can't
 * see — any mismatch simply skips the SSR prefetch and the client fetches
 * normally), prefetches it, and hydrates via `HydrationBoundary` so the table
 * renders in the initial HTML.
 */
export default async function TelescopeRequestsPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const sp = await searchParams;
	const get = (key: string): string | null => {
		const value = sp[key];
		return typeof value === "string" ? value : null;
	};

	const method: string = get("method") ?? "all";
	const status: string = get("status") ?? "all";
	const minDuration: string = get("min") ?? "";
	const q: string = get("q") ?? "";
	const starredOnly: boolean = get("starred") === "true";
	const env: string = get("env") ?? "all";
	const userId: string | null = get("userId");
	const sort: string = get("sort") ?? "newest";
	const correlation: string | null = get("correlation");

	const draft: Record<string, string | number> = { page: 1, pageSize: 20, sort };
	if (method !== "all") draft.method = method;
	if (status !== "all") draft.status = status;
	if (minDuration !== "") draft.minDurationMs = minDuration;
	if (correlation !== null) draft.correlationId = correlation;
	if (userId !== null) draft.userId = userId;
	if (env !== "all") draft.env = env;
	if (q.trim().length > 0) draft.q = q.trim();
	if (starredOnly) draft.starred = "true";
	const query: TelescopeRequestListQuery = TelescopeRequestListQuerySchema.parse(draft);

	const { state, report } = await prefetchPage((server) => [server.telescope.requests(query)]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeRequestsView />
		</PrefetchBoundary>
	);
}
