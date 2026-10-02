"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { Can } from "@workspace/client/lib/auth/can";
import { PERMISSION } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/form/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { SalesStatCards } from "@/components/analytics/sales-stat-cards";
import { DEFAULT_SALES_PERIOD_WEEKS, salesPeriodLabel } from "@/lib/analytics/sales-period";
import { ROUTES } from "@/lib/routes";

/** `{}` — the API's default period, which is the sales page's default preset too. */
const DEFAULT_PERIOD_QUERY = {};

function PlatformSalesCardsContent(): React.JSX.Element {
	const { api } = useAuth();
	const salesQuery = api.rewardsAdmin.salesAnalytics.useQuery(DEFAULT_PERIOD_QUERY);
	const analytics = salesQuery.data?.data;
	const { refetch } = salesQuery;

	const handleRetry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	return (
		<section aria-labelledby="platform-sales-heading" className="space-y-3 px-4 lg:px-6">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 id="platform-sales-heading" className="text-base font-semibold tracking-tight text-foreground">
						Platform sales
					</h2>
					<p className="text-sm text-muted-foreground">{salesPeriodLabel(DEFAULT_SALES_PERIOD_WEEKS)}, vs the previous period</p>
				</div>
				<Link href={ROUTES.analytics.sales} className={buttonVariants({ variant: "ghost", size: "sm" })}>
					View sales analytics
					<ArrowRight aria-hidden="true" />
				</Link>
			</div>
			{analytics === undefined && salesQuery.isError ? (
				<div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
					<span>Couldn&apos;t load platform sales.</span>
					<Button type="button" variant="outline" size="sm" onClick={handleRetry}>
						Try again
					</Button>
				</div>
			) : (
				<SalesStatCards summary={analytics} />
			)}
		</section>
	);
}

/**
 * Overview headline: real platform sales from `GET /admin/analytics/sales`
 * (READ ANALYTICS). The overview page itself is open to every admin, so the
 * section is hidden — and never queried — without that permission.
 */
export function PlatformSalesCards(): React.JSX.Element {
	return (
		<Can permission={PERMISSION.ANALYTICS.READ}>
			<PlatformSalesCardsContent />
		</Can>
	);
}
