"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { BroadcastStatusBadge } from "@/contexts/notifications/components/broadcast-status-badge";
import { BROADCAST_CHANNEL_LABELS, formatWallClock } from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import { BROADCASTS_URL_STATE, toBroadcastsQuery } from "@/contexts/notifications/url-state/broadcasts";
import { tenantRoutes } from "@/lib/routes";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useUrlListPager } from "@workspace/client/lib/url-state/use-url-list-pager";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import type { BroadcastResponse, BroadcastWeeklyAllowance } from "@workspace/shared";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";
import { ListPager } from "@workspace/ui/components/list-pager";
import { Skeleton } from "@workspace/ui/components/skeleton";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cn } from "@workspace/ui/lib/core/utils";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { format } from "date-fns";
import { MegaphoneIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const PAGER_LABELS: UiKitLabelsOverride<"listPager"> = { ariaLabel: "Broadcast pages" };

/** How many placeholder rows show while the first page loads. */
const LOADING_ROWS = 3;

export interface MerchantBroadcastsPageViewProps {
	readonly tenantSlug: string;
}

/** The store's broadcasts (ADR 073): this week's allowance, every message newest first, and the way to write one. */
export function MerchantBroadcastsPageView({ tenantSlug }: MerchantBroadcastsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const routes = tenantRoutes(tenantSlug);
	const [urlState, updateUrlState] = useUrlState(BROADCASTS_URL_STATE);
	const broadcastsQuery = api.tenantNotifications.broadcasts.useQuery({ tenantSlug, ...toBroadcastsQuery(urlState) }, { placeholderData: keepPreviousData });
	const allowanceQuery = api.tenantNotifications.broadcastAllowance.useQuery({ tenantSlug });
	const pager = useUrlListPager(urlState, updateUrlState, broadcastsQuery.data?.meta);
	const allowance = allowanceQuery.data?.data;
	const canWrite = allowance === undefined || (allowance.broadcastingEnabled && allowance.used < allowance.limit);

	return (
		<div className="flex flex-col gap-6">
			<MerchantPageHeader
				title="Broadcasts"
				description="Write to your customers in the app, by email and on their phones. Only customers who agreed to hear from you get them."
				actions={
					<Link href={routes.broadcasts.new} aria-disabled={!canWrite} className={cn(buttonVariants(), !canWrite && "pointer-events-none opacity-50")}>
						New broadcast
					</Link>
				}
			/>
			{allowance === undefined ? null : <BroadcastAllowanceNotice allowance={allowance} />}
			<BroadcastList tenantSlug={tenantSlug} broadcasts={broadcastsQuery.data?.data} isError={broadcastsQuery.isError} newHref={routes.broadcasts.new} canWrite={canWrite} />
			{(broadcastsQuery.data?.data.length ?? 0) > 0 ? (
				<ListPager
					page={pager.page}
					totalPages={pager.totalPages}
					hasPrevious={pager.hasPrevious}
					hasNext={pager.hasNext}
					onPrevious={pager.onPrevious}
					onNext={pager.onNext}
					disabled={broadcastsQuery.isPlaceholderData}
					labels={PAGER_LABELS}
				/>
			) : null}
		</div>
	);
}

/** This week's sends against the limit; a store whose broadcasting was switched off is told why. */
export function BroadcastAllowanceNotice({ allowance }: { readonly allowance: BroadcastWeeklyAllowance }): React.JSX.Element {
	if (!allowance.broadcastingEnabled) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Broadcasting is switched off for your store</AlertTitle>
				<AlertDescription>Customers reported several of your messages and the reports were upheld. Contact support to have it reviewed.</AlertDescription>
			</Alert>
		);
	}
	const left = Math.max(allowance.limit - allowance.used, 0);
	return (
		<p className="text-sm text-muted-foreground" data-slot="broadcast-allowance">
			<span className="font-medium text-foreground tabular-nums">
				{allowance.used} of {allowance.limit}
			</span>{" "}
			broadcasts sent this week. {left === 0 ? "You can send more from Monday." : `${String(left)} left.`}
		</p>
	);
}

interface BroadcastListProps {
	readonly tenantSlug: string;
	readonly broadcasts: readonly BroadcastResponse[] | undefined;
	readonly isError: boolean;
	readonly newHref: string;
	readonly canWrite: boolean;
}

function BroadcastList({ tenantSlug, broadcasts, isError, newHref, canWrite }: BroadcastListProps): React.JSX.Element {
	if (isError) {
		return <p className="text-sm text-muted-foreground">{`Couldn't load your broadcasts. Check your connection and try again.`}</p>;
	}
	if (broadcasts === undefined) {
		return (
			<div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading broadcasts">
				{placeholderKeys("broadcast", LOADING_ROWS).map((key): React.JSX.Element => (
					<Skeleton key={key} className="h-20 w-full rounded-xl" />
				))}
			</div>
		);
	}
	if (broadcasts.length === 0) {
		return (
			<Empty className="rounded-xl border border-dashed border-border">
				<EmptyHeader>
					<MegaphoneIcon className="size-6 text-muted-foreground" aria-hidden="true" />
					<EmptyTitle>No broadcasts yet</EmptyTitle>
					<EmptyDescription>Tell your customers about a new reward, a special day or a change of hours. Pick one customer, a few, or all of them.</EmptyDescription>
				</EmptyHeader>
				{canWrite ? (
					<EmptyContent>
						<Link href={newHref} className={buttonVariants()}>
							Write your first broadcast
						</Link>
					</EmptyContent>
				) : null}
			</Empty>
		);
	}
	return (
		<ul className="flex flex-col gap-3" aria-label="Broadcasts">
			{broadcasts.map((broadcast): React.JSX.Element => (
				<li key={broadcast.id}>
					<BroadcastRow tenantSlug={tenantSlug} broadcast={broadcast} />
				</li>
			))}
		</ul>
	);
}

/** When a broadcast went or goes out, in a line. */
export function describeBroadcastWhen(broadcast: BroadcastResponse): string {
	if (broadcast.completedAt !== null) {
		return `Sent ${format(broadcast.completedAt, "d MMM yyyy, HH:mm")}`;
	}
	if (broadcast.sendMode === "RECIPIENT_LOCAL_TIME" && broadcast.localSendAt !== null) {
		return `${formatWallClock(broadcast.localSendAt)} in each customer's own time`;
	}
	if (broadcast.sendAt !== null) {
		return `Goes out ${format(broadcast.sendAt, "d MMM yyyy, HH:mm")}`;
	}
	return `Written ${format(broadcast.createdAt, "d MMM yyyy")}`;
}

function BroadcastRow({ tenantSlug, broadcast }: { readonly tenantSlug: string; readonly broadcast: BroadcastResponse }): React.JSX.Element {
	return (
		<Card className="gap-0 p-0 transition-colors hover:bg-foreground/[0.03]">
			<Link href={tenantRoutes(tenantSlug).broadcasts.detail(broadcast.id)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
				<span className="flex min-w-0 flex-col gap-1">
					<span className="truncate text-sm font-semibold text-foreground">{broadcast.title}</span>
					<span className="text-xs text-muted-foreground">
						{describeBroadcastWhen(broadcast)} · {broadcast.channels.map((channel) => BROADCAST_CHANNEL_LABELS[channel]).join(", ")}
						{broadcast.audienceCount === null ? "" : ` · ${String(broadcast.audienceCount)} customers`}
					</span>
				</span>
				<BroadcastStatusBadge status={broadcast.status} />
			</Link>
		</Card>
	);
}
