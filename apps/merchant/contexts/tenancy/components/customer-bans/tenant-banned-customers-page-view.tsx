"use client";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { readPaginatedHasNext, readPaginatedNextCursor, readPaginatedTotalPages } from "@workspace/client/lib/api/envelope";
import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_FIRST_PAGE, listPagePatch } from "@workspace/client/lib/url-state/list-url-state";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { MERCHANT_CAPABILITY, PLATFORM_DISPLAY_REGION, type TenantCustomerBanResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { toastMessage } from "@workspace/ui/components/toast";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, UserX } from "lucide-react";
import * as React from "react";

import { BannedCustomerRowsSkeleton, MerchantBannedCustomersPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { BANNED_CUSTOMERS_URL_STATE, toBannedCustomersQuery } from "@/contexts/tenancy/url-state/banned-customers";

import { MerchantCapabilityGate } from "../access/merchant-capability-gate";

function formatWhen(epochMs: number): string {
	return formatEpochMs(epochMs, "dateTime", PLATFORM_DISPLAY_REGION);
}

/** How staff recognise the customer: the redemption the ban was made from (merchants never see who a customer is). */
export function banSourceLabel(ban: TenantCustomerBanResponse): string {
	return ban.source === null ? "Customer from a redemption that no longer exists" : `Customer who redeemed ${ban.source.rewardTitle} on ${formatWhen(ban.source.redeemedAt)}`;
}

export interface TenantBannedCustomersPageViewProps {
	readonly tenantSlug: string;
}

/** Banned customers — requires `merchant:manage_rewards` (the customer-bans endpoints); the list mounts only when allowed. */
export function TenantBannedCustomersPageView(props: TenantBannedCustomersPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageRewards} loading={<MerchantBannedCustomersPageSkeleton />}>
			<TenantBannedCustomersPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

interface BanRowProps {
	readonly tenantSlug: string;
	readonly ban: TenantCustomerBanResponse;
}

/** One active ban, and lifting it (`POST /tenants/:tenantSlug/customer-bans/:banId/lift`). */
function BanRow({ tenantSlug, ban }: BanRowProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [error, setError] = React.useState<string | null>(null);
	const lift = api.tenants.liftCustomerBan.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Ban lifted", description: "The customer can claim and redeem your rewards again." });
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: apiRouter.tenants.customerBans.scopeKey({ tenantSlug }) }),
				queryClient.invalidateQueries({ queryKey: apiRouter.tenants.redemptions.scopeKey({ tenantSlug }) }),
			]);
		},
		onError: (caught) => {
			setError(resolveAuthErrorMessage(caught));
		},
	});
	const { mutate: liftBan } = lift;
	const handleLift = React.useCallback((): void => {
		setError(null);
		liftBan({ tenantSlug, banId: ban.id });
	}, [ban.id, liftBan, tenantSlug]);

	return (
		<Card className="gap-2 px-5 py-4">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 space-y-1">
					<p className="font-medium text-foreground">{banSourceLabel(ban)}</p>
					<p className="text-sm whitespace-pre-wrap text-foreground">{ban.reason}</p>
					<p className="text-xs text-muted-foreground">
						Banned {formatWhen(ban.bannedAt)}
						{ban.bannedBy === null ? "" : ` by ${ban.bannedBy.fullName}`}
					</p>
				</div>
				<Button type="button" variant="outline" size="sm" onClick={handleLift} disabled={lift.isPending}>
					Lift ban
				</Button>
			</div>
			{error !== null ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
		</Card>
	);
}

function TenantBannedCustomersPageContent({ tenantSlug }: TenantBannedCustomersPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const [urlState, updateUrlState] = useUrlState(BANNED_CUSTOMERS_URL_STATE);
	const bansQuery = api.tenants.customerBans.useQuery(toBannedCustomersQuery(tenantSlug, urlState));
	const bans: readonly TenantCustomerBanResponse[] = bansQuery.data?.data ?? [];
	const meta = bansQuery.data?.meta;
	const isFirstPage = urlState.page === LIST_FIRST_PAGE;
	const hasNext = readPaginatedHasNext(meta);
	const nextCursor = readPaginatedNextCursor(meta);

	const handleNext = React.useCallback((): void => {
		updateUrlState(listPagePatch(urlState, urlState.page + 1, nextCursor));
	}, [nextCursor, updateUrlState, urlState]);
	const handlePrevious = React.useCallback((): void => {
		updateUrlState(listPagePatch(urlState, urlState.page - 1, null));
	}, [updateUrlState, urlState]);

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title="Banned customers"
				description="Customers you banned can't claim your rewards, and your tills refuse their codes. Ban a customer from a row of the redemption log."
			/>
			{bansQuery.isLoading ? (
				<BannedCustomerRowsSkeleton />
			) : bansQuery.isError ? (
				<p role="alert" className="text-sm text-destructive">
					{resolveAuthErrorMessage(bansQuery.error)}
				</p>
			) : bans.length === 0 ? (
				<Empty className="border bg-card">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UserX className="size-5" aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle role="heading" aria-level={2}>
							No banned customers
						</EmptyTitle>
						<EmptyDescription>Every customer can claim and redeem your rewards.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<div className="space-y-3">
					{bans.map((ban) => (
						<BanRow key={ban.id} tenantSlug={tenantSlug} ban={ban} />
					))}
					{!isFirstPage || hasNext ? (
						<nav aria-label="Banned customers pages" className="flex items-center justify-between gap-3 border-t border-border pt-4">
							<Button type="button" variant="outline" disabled={isFirstPage} onClick={handlePrevious} className="gap-1.5">
								<ChevronLeft className="size-4" aria-hidden="true" />
								Previous
							</Button>
							<p className="text-sm text-muted-foreground tabular-nums">{`Page ${String(urlState.page)} of ${String(readPaginatedTotalPages(meta, urlState.page))}`}</p>
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
