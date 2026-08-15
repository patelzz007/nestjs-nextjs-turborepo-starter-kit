import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";

import { prefetchPage } from "@workspace/client/lib/api/server-api";

import TelescopeCompareView from "./request-compare";

export const dynamic = "force-dynamic";

/**
 * `/telescope/compare?a=&b=` — request diff. Prefetches the comparison
 * server-side only when both ids are present (the client disables its query
 * otherwise). The input `{ a, b }` is the same object the client view passes,
 * so the prefetch key + URL match the client's `useQuery`.
 */
export default async function TelescopeComparePage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const sp = await searchParams;
	const idA: string | null = typeof sp.a === "string" && sp.a.length > 0 ? sp.a : null;
	const idB: string | null = typeof sp.b === "string" && sp.b.length > 0 ? sp.b : null;

	const { state, report } = await prefetchPage((server) => [server.telescope.compare({ a: idA ?? "", b: idB ?? "" }, { enabled: idA !== null && idB !== null })]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<TelescopeCompareView />
		</PrefetchBoundary>
	);
}
