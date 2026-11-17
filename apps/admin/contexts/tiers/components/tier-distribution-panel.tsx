"use client";

import { analyticsFormatters, toChartFrameState, type AnalyticsDataStatus } from "@workspace/client/lib/contexts/reporting";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { toTierShareSegments, useTiersEnabled, type TierCount } from "@workspace/client/lib/contexts/tiers";
import { CustomerTierSchema, DEFAULT_SALE_CURRENCY, PLATFORM_DISPLAY_REGION, type CustomerTier, type TierDistribution } from "@workspace/shared";
import { AnalyticsPanel } from "@workspace/ui/components/analytics-panel";
import { ShareBar } from "@workspace/ui/components/share-bar";
import * as React from "react";

/** Each tier's customers, in tier order (the API lists every tier, zero included). */
export function toTierCounts(distribution: TierDistribution): readonly TierCount[] {
	return CustomerTierSchema.options.map((tier: CustomerTier): TierCount => ({ tier, count: distribution.counts[tier] }));
}

/** The distribution's load state, as the analytics charts read it. */
function dataStatus(hasData: boolean, isError: boolean, retry: () => void): AnalyticsDataStatus {
	if (isError && !hasData) {
		return { status: "error", message: "Couldn't load the tier distribution.", onRetry: retry };
	}
	return hasData ? { status: "ready" } : { status: "loading" };
}

/**
 * How many customers stand at each tier right now (ADR 085), across the platform. A snapshot, not the page's range:
 * a customer's tier is where they stand today. Nothing while tiers are off.
 */
export function TierDistributionPanel(): React.JSX.Element | null {
	const { api } = useAuth();
	const tiersEnabled = useTiersEnabled();
	const query = api.tiers.distribution.useQuery(undefined, { enabled: tiersEnabled });
	const formatters = React.useMemo(() => analyticsFormatters(DEFAULT_SALE_CURRENCY, PLATFORM_DISPLAY_REGION.locale), []);
	const { refetch } = query;
	const retry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);
	if (!tiersEnabled) {
		return null;
	}
	const distribution = query.data?.data;
	const segments = distribution === undefined ? [] : toTierShareSegments(toTierCounts(distribution), formatters);
	const state = toChartFrameState(dataStatus(distribution !== undefined, query.isError, retry), distribution?.total === 0, "No customers yet.");
	return (
		<AnalyticsPanel title="Customers by tier" description="Where every customer stands today">
			<ShareBar label="Customers by tier" segments={segments} state={state} />
		</AnalyticsPanel>
	);
}
