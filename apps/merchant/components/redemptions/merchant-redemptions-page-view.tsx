"use client";

import { MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { MerchantLocationScopeBanner } from "@/components/layout/merchant-location-scope-banner";
import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantStatCard } from "@/components/merchant-ui/stat-card";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { RedemptionsPager } from "@/components/redemptions/redemptions-pager";
import { initialDataOption, readPaginatedHasNext, readPaginatedNextCursor, readPaginatedTotalPages } from "@workspace/client/lib/api/envelope";
import { useActiveLocationFilter } from "@/features/tenant-context/facade";
import { prefetchForLocation, type LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { REDEMPTIONS_URL_STATE, toRedemptionsQuery } from "@/lib/url-state/redemptions";
import { useAuth } from "@workspace/client/lib/auth";
import { LIST_FIRST_PAGE, listPagePatch } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { MERCHANT_CAPABILITY, type Envelope, type MerchantRedemptionListItem } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { format } from "date-fns";
import { CalendarClock, Receipt, ScanLine } from "lucide-react";
import * as React from "react";

export interface MerchantRedemptionsPageViewProps {
	readonly orgSlug: string;
	/** The page the server prefetched, bound to the store filter AND the URL state it was fetched for. */
	readonly initialRedemptions?: LocationScopedPrefetch<PrefetchedQuery<Envelope<MerchantRedemptionListItem[]>>> | undefined;
}

/** Redemptions route — requires `merchant:view_redemptions` (redemptions endpoint); the query mounts only when allowed. */
export function MerchantRedemptionsPageView(props: MerchantRedemptionsPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewRedemptions}>
			<MerchantRedemptionsPageViewContent {...props} />
		</MerchantCapabilityGate>
	);
}

function MerchantRedemptionsPageViewContent({ orgSlug, initialRedemptions }: MerchantRedemptionsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { locationId } = useActiveLocationFilter();

	// The page is URL state (`?page=`); the store is the tenant-context filter.
	const [urlState, updateUrlState] = useUrlState(REDEMPTIONS_URL_STATE);

	// Seed only with the page the server fetched for this exact store AND URL state — never another store's
	// rows, nor another page's, under this key.
	const prefetchedPage = prefetchedDataFor(prefetchForLocation(initialRedemptions, locationId), REDEMPTIONS_URL_STATE.serialize(urlState));
	const redemptionsQuery = api.organizations.redemptions.useQuery(toRedemptionsQuery(orgSlug, locationId, urlState), initialDataOption(prefetchedPage));
	const rows: readonly MerchantRedemptionListItem[] = redemptionsQuery.data?.data ?? [];
	const isLoading = redemptionsQuery.isLoading;
	const meta = redemptionsQuery.data?.meta;
	const isFirstPage = urlState.page === LIST_FIRST_PAGE;
	const hasNext = readPaginatedHasNext(meta);
	const nextCursor = readPaginatedNextCursor(meta);

	// Page moves push a history entry, so Back returns to the previous page.
	const handleNext = React.useCallback((): void => {
		updateUrlState(listPagePatch(urlState, urlState.page + 1, nextCursor));
	}, [nextCursor, updateUrlState, urlState]);

	const handlePrevious = React.useCallback((): void => {
		updateUrlState(listPagePatch(urlState, urlState.page - 1, null));
	}, [updateUrlState, urlState]);

	const handleFirstPage = React.useCallback((): void => {
		updateUrlState(listPagePatch(urlState, LIST_FIRST_PAGE, null));
	}, [updateUrlState, urlState]);

	const todayCount = rows.filter((row) => {
		const redeemed = new Date(row.redeemedAt);
		const now = new Date();
		return redeemed.getDate() === now.getDate() && redeemed.getMonth() === now.getMonth() && redeemed.getFullYear() === now.getFullYear();
	}).length;

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="Redemptions" description="Recent POS redemptions for the selected store — newest first." />
			<MerchantLocationScopeBanner />

			<div className="grid gap-4 sm:grid-cols-2">
				<MerchantStatCard
					label="Showing"
					value={String(rows.length)}
					hint={isFirstPage ? "Latest page of activity" : `Page ${String(urlState.page)} of activity`}
					icon={<Receipt className="size-4" aria-hidden="true" />}
				/>
				<MerchantStatCard label="Today" value={String(todayCount)} hint="Redeemed since midnight" icon={<CalendarClock className="size-4" aria-hidden="true" />} />
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">Loading redemptions…</p>
			) : rows.length === 0 && !isFirstPage ? (
				<MerchantEmptyState
					title="No redemptions on this page"
					description="This page is past the end of the redemption log for the selected store."
					icon={<ScanLine className="size-5" aria-hidden="true" />}
					action={
						<Button type="button" onClick={handleFirstPage}>
							Go to the latest redemptions
						</Button>
					}
				/>
			) : rows.length === 0 ? (
				<MerchantEmptyState
					title="No redemptions yet"
					description="When customers redeem at your POS terminals, activity will appear here with terminal and method details."
					icon={<ScanLine className="size-5" aria-hidden="true" />}
				/>
			) : (
				<div className="space-y-3">
					{rows.map((row) => (
						<MerchantSurfacePanel key={row.redemptionId} className="px-5 py-4">
							<div className="flex flex-wrap items-center justify-between gap-4">
								<div className="min-w-0 space-y-1">
									<p className="font-medium text-foreground">{row.rewardTitle}</p>
									<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
										<span>{row.terminalId}</span>
										<span aria-hidden="true">·</span>
										<Badge variant="secondary">{row.redemptionMethod}</Badge>
									</div>
								</div>
								<time className="shrink-0 text-sm text-muted-foreground tabular-nums" dateTime={new Date(row.redeemedAt).toISOString()}>
									{format(new Date(row.redeemedAt), "d MMM yyyy · HH:mm")}
								</time>
							</div>
						</MerchantSurfacePanel>
					))}
					{!isFirstPage || hasNext ? (
						<RedemptionsPager
							page={urlState.page}
							totalPages={readPaginatedTotalPages(meta, urlState.page)}
							hasPrevious={!isFirstPage}
							hasNext={hasNext}
							onPrevious={handlePrevious}
							onNext={handleNext}
						/>
					) : null}
				</div>
			)}
		</div>
	);
}
