"use client";

import { MerchantRewardDetailPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { BroadcastStatusBadge } from "@/contexts/notifications/components/broadcast-status-badge";
import { BroadcastUnavailable } from "@/contexts/notifications/components/merchant-broadcast-editor-pages";
import { describeBroadcastWhen } from "@/contexts/notifications/components/merchant-broadcasts-page-view";
import { BROADCAST_CHANNEL_LABELS, broadcastTotals, isBroadcastCancellable, isBroadcastEditable } from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import { MerchantCapabilityGate } from "@/contexts/tenancy";
import { tenantRoutes } from "@/lib/routes";
import { userSafeErrorMessage } from "@/lib/query/query-policy";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { MERCHANT_CAPABILITY, type BroadcastResponse } from "@workspace/shared";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { RichTextView } from "@workspace/ui/components/rich-text-view";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { toastMessage } from "@workspace/ui/components/toast";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

/** How often a broadcast on its way is re-read, so its results fill in. */
const SENDING_REFRESH_MS = 10_000;

export interface MerchantBroadcastDetailPageViewProps {
	readonly tenantSlug: string;
	readonly broadcastId: string;
}

/** `/t/:tenantSlug/broadcasts/:broadcastId` — one broadcast: its state, who and how, the results, and the message. */
export function MerchantBroadcastDetailPageView(props: MerchantBroadcastDetailPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageBroadcasts} loading={<MerchantRewardDetailPageSkeleton />}>
			<MerchantBroadcastDetailContent {...props} />
		</MerchantCapabilityGate>
	);
}

function MerchantBroadcastDetailContent({ tenantSlug, broadcastId }: MerchantBroadcastDetailPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const broadcastQuery = api.tenantNotifications.broadcast.useQuery(
		{ tenantSlug, broadcastId },
		{
			refetchInterval: (query): number | false => (query.state.data?.data.status === "SENDING" || query.state.data?.data.status === "SCHEDULED" ? SENDING_REFRESH_MS : false),
		},
	);
	if (broadcastQuery.isError) {
		return <BroadcastUnavailable tenantSlug={tenantSlug} message={userSafeErrorMessage(broadcastQuery.error, "Could not load this broadcast.")} />;
	}
	const broadcast = broadcastQuery.data?.data;
	if (broadcast === undefined) {
		return <MerchantRewardDetailPageSkeleton />;
	}
	return <MerchantBroadcastDetail tenantSlug={tenantSlug} broadcast={broadcast} />;
}

interface MerchantBroadcastDetailProps {
	readonly tenantSlug: string;
	readonly broadcast: BroadcastResponse;
}

function DetailRow({ term, children }: { readonly term: string; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<div className="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
			<dt className="text-sm text-muted-foreground">{term}</dt>
			<dd className="text-sm text-foreground">{children}</dd>
		</div>
	);
}

/** Who a saved broadcast went to, in words. */
export function describeBroadcastAudience(broadcast: BroadcastResponse): string {
	if (broadcast.audience.kind !== "tenant-customers") {
		return "Platform users";
	}
	const { customerIds, claimedWithinDays, redeemed } = broadcast.audience;
	if (customerIds !== null) {
		return customerIds.length === 1 ? "1 customer you picked" : `${String(customerIds.length)} customers you picked`;
	}
	const redeemedText = redeemed === "redeemed" ? ", who redeemed" : redeemed === "not-redeemed" ? ", who have not redeemed yet" : "";
	return `Customers who claimed in the last ${String(claimedWithinDays)} days${redeemedText}`;
}

function MerchantBroadcastDetail({ tenantSlug, broadcast }: MerchantBroadcastDetailProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const queryClient = useQueryClient();
	const routes = tenantRoutes(tenantSlug).broadcasts;
	const canSend = can(MERCHANT_CAPABILITY.publishBroadcasts);

	const applyChange = React.useCallback(
		(response: { readonly data: BroadcastResponse }): void => {
			const defs = apiRouter.tenantNotifications;
			queryClient.setQueryData(defs.broadcast.queryKey({ tenantSlug, broadcastId: response.data.id }), response);
			void queryClient.invalidateQueries({ queryKey: defs.broadcasts.scopeKey({ tenantSlug }) });
			void queryClient.invalidateQueries({ queryKey: defs.broadcastAllowance.scopeKey({ tenantSlug }) });
		},
		[queryClient, tenantSlug],
	);
	const schedule = api.tenantNotifications.scheduleBroadcast.useMutation({
		onSuccess: (response): void => {
			applyChange(response);
			toastMessage.success({
				title: response.data.status === "PENDING_APPROVAL" ? "Sent for approval" : "Broadcast scheduled",
				description: "Its results fill in here as it goes out.",
			});
		},
		onError: (error): void => {
			toastMessage.error({ title: "Broadcast not sent", description: userSafeErrorMessage(error, "Check your connection and try again.") });
		},
	});
	const cancel = api.tenantNotifications.cancelBroadcast.useMutation({
		onSuccess: (response): void => {
			applyChange(response);
			toastMessage.success({ title: "Broadcast cancelled", description: "No one else receives it." });
		},
		onError: (error): void => {
			toastMessage.error({ title: "Broadcast not cancelled", description: userSafeErrorMessage(error, "Check your connection and try again.") });
		},
	});
	const { mutate: scheduleMutate } = schedule;
	const { mutate: cancelMutate } = cancel;
	const handleSchedule = React.useCallback((): void => {
		scheduleMutate({ tenantSlug, broadcastId: broadcast.id });
	}, [broadcast.id, scheduleMutate, tenantSlug]);
	const handleCancel = React.useCallback((): void => {
		cancelMutate({ tenantSlug, broadcastId: broadcast.id });
	}, [broadcast.id, cancelMutate, tenantSlug]);
	const totals = broadcastTotals(broadcast);
	const busy = schedule.isPending || cancel.isPending;

	return (
		<div className="flex flex-col gap-6">
			<Link href={appRoute(routes.list)} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeftIcon className="size-4" aria-hidden="true" />
				All broadcasts
			</Link>
			<div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
				<div className="flex min-w-0 flex-col gap-2">
					<BroadcastStatusBadge status={broadcast.status} />
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">{broadcast.title}</h1>
					<p className="text-sm text-muted-foreground">{describeBroadcastWhen(broadcast)}</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{isBroadcastEditable(broadcast.status) ? (
						<Link href={appRoute(routes.edit(broadcast.id))} className={cn(buttonVariants({ variant: "outline" }))}>
							Edit
						</Link>
					) : null}
					{broadcast.status === "DRAFT" && canSend ? (
						<Button type="button" onClick={handleSchedule} disabled={busy}>
							{broadcast.sendAt === null && broadcast.localSendAt === null ? "Send" : "Schedule"}
						</Button>
					) : null}
					{isBroadcastCancellable(broadcast.status) ? (
						<Button type="button" variant="outline" onClick={handleCancel} disabled={busy}>
							Cancel broadcast
						</Button>
					) : null}
				</div>
			</div>

			{broadcast.status === "PAUSED" ? (
				<Alert variant="warning">
					<AlertTitle>Paused</AlertTitle>
					<AlertDescription>{broadcast.pauseReason ?? "Several customers reported it. Our team is looking at it."}</AlertDescription>
				</Alert>
			) : null}

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
				<section aria-labelledby="broadcast-message-heading" className="flex flex-col gap-3">
					<h2 id="broadcast-message-heading" className="text-base font-semibold text-foreground">
						Message
					</h2>
					<Card className="px-5 py-4">
						<RichTextView document={broadcast.body} />
					</Card>
				</section>
				<div className="flex flex-col gap-6">
					<section aria-labelledby="broadcast-details-heading" className="flex flex-col gap-3">
						<h2 id="broadcast-details-heading" className="text-base font-semibold text-foreground">
							Details
						</h2>
						<Card className="gap-0 px-5 py-2">
							<dl className="divide-y divide-border">
								<DetailRow term="Who">{describeBroadcastAudience(broadcast)}</DetailRow>
								<DetailRow term="Reached">{broadcast.audienceCount === null ? "Counted when it goes out" : `${String(broadcast.audienceCount)} customers`}</DetailRow>
								<DetailRow term="How">{broadcast.channels.map((channel) => BROADCAST_CHANNEL_LABELS[channel]).join(", ")}</DetailRow>
								<DetailRow term="Reports">{broadcast.openReports === 0 ? "None" : `${String(broadcast.openReports)} open`}</DetailRow>
							</dl>
						</Card>
					</section>
					{broadcast.results.length === 0 ? null : (
						<section aria-labelledby="broadcast-results-heading" className="flex flex-col gap-3">
							<h2 id="broadcast-results-heading" className="text-base font-semibold text-foreground">
								Results
							</h2>
							<p className="text-sm text-muted-foreground">
								{totals.delivered} delivered · {totals.failed} failed · {totals.suppressed} held back by customers&apos; settings
							</p>
							<Card className="gap-0 overflow-x-auto p-0">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Channel</TableHead>
											<TableHead className="text-end">Targeted</TableHead>
											<TableHead className="text-end">Delivered</TableHead>
											<TableHead className="text-end">Failed</TableHead>
											<TableHead className="text-end">Opened</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{broadcast.results.map((result): React.JSX.Element => (
											<TableRow key={result.channel}>
												<TableCell>{BROADCAST_CHANNEL_LABELS[result.channel]}</TableCell>
												<TableCell className="text-end tabular-nums">{result.targeted}</TableCell>
												<TableCell className="text-end tabular-nums">{result.delivered}</TableCell>
												<TableCell className="text-end tabular-nums">{result.failed}</TableCell>
												<TableCell className="text-end tabular-nums">{result.engaged ?? "—"}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</Card>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}
