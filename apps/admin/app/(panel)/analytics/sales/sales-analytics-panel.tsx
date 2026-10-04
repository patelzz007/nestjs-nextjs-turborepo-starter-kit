"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { AdminSalesAnalyticsQuery, AdminSalesAnalyticsResponse, Envelope } from "@workspace/shared";
import { useRouter } from "next/navigation";
import * as React from "react";

import { hasSalesInPeriod, toTopMerchantRows } from "@/lib/analytics/sales-analytics";
import type { SalesPeriodWeeks } from "@/lib/analytics/sales-period";
import { ROUTES } from "@/lib/routes";
import { SALES_ANALYTICS_URL_STATE } from "@/lib/url-state/analytics";

import { SalesAnalyticsView, type SalesAnalyticsState } from "./sales-analytics-view";

export interface SalesAnalyticsPanelProps {
	readonly weeks: SalesPeriodWeeks;
	/** The period resolved on the server for `weeks` — also the query key of the prefetched data. */
	readonly query: AdminSalesAnalyticsQuery;
	/** The API's own envelope from the server prefetch (real `meta`), seeded as the query's initial data. */
	readonly initialAnalytics?: Envelope<AdminSalesAnalyticsResponse> | undefined;
}

/**
 * Smart component of `/analytics/sales`: owns the query, the URL period, and
 * the loading / error / empty decision. The route guard already requires
 * READ ANALYTICS, so the page does not re-check it.
 */
export default function SalesAnalyticsPanel({ weeks, query, initialAnalytics }: SalesAnalyticsPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const [isNavigating, startNavigation] = React.useTransition();

	const analyticsQuery = api.rewardsAdmin.salesAnalytics.useQuery(query, initialDataOption(initialAnalytics));
	const analytics = analyticsQuery.data?.data;
	const errorMessage = analyticsQuery.error?.message;

	const state = React.useMemo((): SalesAnalyticsState => {
		// Keep showing the last good numbers while a refetch fails or runs.
		if (analytics !== undefined) {
			return { status: "success", data: analytics, topMerchants: toTopMerchantRows(analytics), hasSales: hasSalesInPeriod(analytics.sales) };
		}
		if (errorMessage !== undefined) {
			return { status: "error", message: errorMessage };
		}
		return { status: "loading" };
	}, [analytics, errorMessage]);

	const handleWeeksChange = React.useCallback(
		(nextWeeks: SalesPeriodWeeks): void => {
			startNavigation(() => {
				router.push(SALES_ANALYTICS_URL_STATE.href(ROUTES.analytics.sales, { weeks: nextWeeks }), { scroll: false });
			});
		},
		[router],
	);

	const { refetch } = analyticsQuery;
	const handleRetry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	return <SalesAnalyticsView state={state} weeks={weeks} onWeeksChange={handleWeeksChange} onRetry={handleRetry} isRefreshing={isNavigating || analyticsQuery.isFetching} />;
}
