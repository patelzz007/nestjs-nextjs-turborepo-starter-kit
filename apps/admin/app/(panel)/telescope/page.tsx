import { TelescopeRangeSchema, type TelescopeRange } from "@workspace/shared";

import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeOverviewView from "./overview";

export const dynamic = "force-dynamic";

/**
 * `/telescope` — the live overview dashboard. Server component: fetches the
 * overview snapshot (range from `?range=`) and the preview cards through the
 * admin cookies, then passes them as props to the client view — the views keep
 * plain `useQuery()` and the initial SSR HTML already contains the real stats
 * (no skeleton flash). The SSE stream + range picker stay client-side.
 */
export default async function TelescopeOverviewPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const sp = await searchParams;
	const rawRange: string | undefined = typeof sp.range === "string" ? sp.range : undefined;
	const parsedRange = TelescopeRangeSchema.safeParse(rawRange);
	const range: TelescopeRange = parsedRange.success ? parsedRange.data : "15m";

	const server = createServerCaller();

	// Fetch all 7 overview queries in parallel
	const [overviewData, exceptionsData, trendsData, leaderboardData, alertsData, starredData, deliveriesData] = await Promise.all([
		server.telescope.overview.query({ range }),
		server.telescope.exceptions.query({ page: 1, pageSize: 5 }),
		server.telescope.trends.query({ range }),
		server.telescope.leaderboard.query({ range }),
		server.telescope.alerts.query(undefined),
		server.telescope.requests.query({ page: 1, pageSize: 5, sort: "newest", starred: "true" }),
		server.telescope.webhookDeliveries.query(undefined),
	]);

	return (
		<TelescopeOverviewView
			initialOverview={overviewData}
			initialExceptions={exceptionsData}
			initialTrends={trendsData}
			initialLeaderboard={leaderboardData}
			initialAlerts={alertsData}
			initialStarred={starredData}
			initialDeliveries={deliveriesData}
		/>
	);
}
