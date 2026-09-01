import { createAdminServerCaller } from "@/lib/admin-server-api";

import GeoView from "./geo-table";

export const dynamic = "force-dynamic";

/**
 * `/geo` — Geographic data management page.
 * Server component: prefetches stats so the stat cards render in the initial HTML.
 * The DataTable data is fetched client-side (react-query) for interactive sorting/filtering.
 */
export default async function GeoPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();

	const statsResult = await Promise.allSettled([server.geo.stats.query({})]);

	const firstResult = statsResult[0];
	const stats = firstResult.status === "fulfilled" ? firstResult.value.data : undefined;

	return <GeoView initialStats={stats} />;
}
