// The Analytics screen's data sources. Today they build the sample activity
// on the device (sample-dashboard.ts, sample-insights.ts) — the screen makes
// no request. The dashboard's type is the API's own contract, so reading the
// real endpoint later replaces its body with the query and leaves the screen
// as it is:
//
//   return api.claims.analyticsDashboard.useQuery({ from: range.from, to: range.to });
//
// (and the screen then handles the query's loading and error states, like
// every other screen that reads the API). The insights have no endpoint yet:
// ActivityInsights (activity-insights.ts) is the shape one would return.

import type { AnalyticsReportRange, CustomerAnalyticsDashboard, LocalDate } from "@workspace/shared";
import * as React from "react";

import { useNow } from "../../lib/use-now";
import type { ActivityInsights } from "./activity-insights";
import { activityToday } from "./activity-range";
import { sampleActivityDashboard } from "./sample-dashboard";
import { sampleActivityInsights } from "./sample-insights";

/** How often "today" is re-read, so the range moves on at midnight while the screen stays open. */
const TODAY_REFRESH_MS = 60_000;

/** Today in the activity's zone, moving on at midnight. */
export function useActivityToday(): LocalDate {
	const nowMs = useNow({ intervalMs: TODAY_REFRESH_MS, running: true });
	return activityToday(nowMs);
}

export function useActivityDashboard(range: AnalyticsReportRange): CustomerAnalyticsDashboard {
	return React.useMemo((): CustomerAnalyticsDashboard => sampleActivityDashboard(range), [range]);
}

export function useActivityInsights(range: AnalyticsReportRange): ActivityInsights {
	return React.useMemo((): ActivityInsights => sampleActivityInsights(range), [range]);
}
