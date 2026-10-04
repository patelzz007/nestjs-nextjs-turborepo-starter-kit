"use client";

import { initialDataOption, readPaginatedHasNext, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { LIST_FIRST_PAGE, listPagePatch } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { WebEmptyState } from "@/components/web-ui/empty-state";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { WebStatCard } from "@/components/web-ui/stat-card";
import { WebSurfacePanel } from "@/components/web-ui/surface-panel";
import { useAuth } from "@workspace/client/lib/auth";
import { PLATFORM_DISPLAY_REGION, type Envelope, type RewardClaimResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button, buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { AlertTriangle, ChevronLeft, ChevronRight, Gift, QrCode, Ticket } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { ROUTES, walletClaimPath } from "@/lib/routes";
import { toReadyToRedeemCountQuery, toWalletClaimsListQuery, WALLET_CLAIMS_URL_STATE } from "@/lib/url-state/wallet-claims";

/** A stat whose server count has not arrived yet. */
const PENDING_STAT_VALUE = "—";

type ClaimsPage = Envelope<RewardClaimResponse[]>;

export interface MyClaimsPageViewProps {
	/** The page of claims the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<ClaimsPage> | undefined;
	/** The server's "ready to redeem" count response (`meta.total`), prefetched with the page. */
	readonly initialReadyCount?: ClaimsPage | undefined;
}

/**
 * The signed-in user's reward claims, one URL-addressed page at a time. Both
 * stat cards show counts the SERVER computed over the whole account
 * (`meta.total`), never a sum over the page on screen.
 */
export function MyClaimsPageView({ initialPage, initialReadyCount }: MyClaimsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const [urlState, updateUrlState] = useUrlState(WALLET_CLAIMS_URL_STATE);

	const prefetchedPage = prefetchedDataFor(initialPage, WALLET_CLAIMS_URL_STATE.serialize(urlState));
	const claimsQuery = api.claims.list.useQuery(toWalletClaimsListQuery(urlState), initialDataOption(prefetchedPage));
	const readyCountQuery = api.claims.list.useQuery(toReadyToRedeemCountQuery(), initialDataOption(initialReadyCount));

	const claims: readonly RewardClaimResponse[] = claimsQuery.data?.data ?? [];
	const isLoading = claimsQuery.isLoading;
	const hasNext = readPaginatedHasNext(claimsQuery.data?.meta);
	const nextCursor = readPaginatedNextCursor(claimsQuery.data?.meta);
	const hasPrevious = urlState.page > LIST_FIRST_PAGE;

	const totalClaims = claimsQuery.data === undefined ? PENDING_STAT_VALUE : String(readPaginatedTotal(claimsQuery.data.meta));
	const readyToRedeem = readyCountQuery.data === undefined ? PENDING_STAT_VALUE : String(readPaginatedTotal(readyCountQuery.data.meta));

	const handleRetry = React.useCallback((): void => {
		void claimsQuery.refetch();
	}, [claimsQuery]);

	const handleNext = React.useCallback((): void => {
		updateUrlState(listPagePatch(urlState, urlState.page + 1, nextCursor));
	}, [nextCursor, updateUrlState, urlState]);

	const handlePrevious = React.useCallback((): void => {
		if (urlState.page <= LIST_FIRST_PAGE) {
			return;
		}
		updateUrlState(listPagePatch(urlState, urlState.page - 1, null));
	}, [updateUrlState, urlState]);

	return (
		<div className="space-y-8">
			<WebPageHeader title="My rewards" description="Active claims ready for redemption at the merchant." />

			<div className="grid gap-4 sm:grid-cols-2">
				<WebStatCard label="Total claims" value={totalClaims} hint="On this account" icon={<Ticket className="size-4" aria-hidden="true" />} />
				<WebStatCard label="Ready to redeem" value={readyToRedeem} hint="Show QR at checkout" icon={<QrCode className="size-4" aria-hidden="true" />} />
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">Loading claims…</p>
			) : claimsQuery.isError && claimsQuery.data === undefined ? (
				<WebEmptyState
					title="Couldn't load your claims"
					description="Something went wrong while loading your wallet. Your claims are safe — try again in a moment."
					icon={<AlertTriangle className="size-5" aria-hidden="true" />}
					action={
						<Button type="button" onClick={handleRetry}>
							Try again
						</Button>
					}
				/>
			) : claims.length === 0 && !hasPrevious ? (
				<WebEmptyState
					title="No claims yet"
					description="Browse local rewards and claim your first offer — it will appear here with a QR code for redemption."
					icon={<Gift className="size-5" aria-hidden="true" />}
					action={
						<Link href={ROUTES.rewardHub.browse} className={cn(buttonVariants())}>
							Browse rewards
						</Link>
					}
				/>
			) : (
				<div className="space-y-3">
					{claims.map((claim) => (
						<WebSurfacePanel key={claim.id} accent={claim.status === "PENDING"} className="px-5 py-4">
							<div className="flex flex-wrap items-center justify-between gap-4">
								<div className="min-w-0 space-y-1">
									<p className="font-medium text-foreground">{claim.rewardTitle}</p>
									<p className="text-sm text-muted-foreground">Claimed {formatEpochMs(claim.claimedAt, "dateTime", PLATFORM_DISPLAY_REGION)}</p>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="outline">{claim.status}</Badge>
									{claim.status === "PENDING" ? (
										<Link href={walletClaimPath(claim.id)} className={cn(buttonVariants())}>
											Show QR
										</Link>
									) : null}
								</div>
							</div>
						</WebSurfacePanel>
					))}
					{hasPrevious || hasNext ? (
						<nav aria-label="Wallet pages" className="flex items-center justify-between gap-3 border-t border-border pt-4">
							<Button type="button" variant="outline" disabled={!hasPrevious} onClick={handlePrevious} className="gap-1.5">
								<ChevronLeft className="size-4" aria-hidden="true" />
								Previous
							</Button>
							<p className="text-sm text-muted-foreground tabular-nums">Page {urlState.page}</p>
							<Button type="button" variant="outline" disabled={!hasNext} onClick={handleNext} className="gap-1.5">
								Next
								<ChevronRight className="size-4" aria-hidden="true" />
							</Button>
						</nav>
					) : null}
				</div>
			)}
		</div>
	);
}
