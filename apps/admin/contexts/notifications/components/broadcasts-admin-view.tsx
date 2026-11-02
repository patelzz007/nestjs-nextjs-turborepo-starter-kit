"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { BROADCAST_STATUS_LABELS, isBroadcastCancellable } from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_DEFAULT_LIMIT, PERMISSION, type BroadcastReportEntry, type BroadcastResponse, type BroadcastStatus, type ReviewBroadcastReportInput } from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { RichTextView } from "@workspace/ui/components/rich-text-view";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { toastMessage } from "@workspace/ui/components/toast";
import { Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

export const BROADCAST_STATUS_TONES: Readonly<Record<BroadcastStatus, StatusTone>> = {
	DRAFT: "muted",
	PENDING_APPROVAL: "warning",
	SCHEDULED: "info",
	SENDING: "info",
	SENT: "success",
	PAUSED: "warning",
	CANCELLED: "neutral",
	FAILED: "danger",
};

/** Reviews are audited: the decision's note when staff leave none. */
const REVIEW_NOTES: Readonly<Record<ReviewBroadcastReportInput["decision"], string>> = {
	dismiss: "Not a breach of the broadcast rules",
	uphold: "Upheld: breaches the broadcast rules",
	resume: "Reviewed and resumed",
};

function useInvalidateBroadcasts(): () => Promise<void> {
	const queryClient = useQueryClient();
	return React.useCallback(async (): Promise<void> => {
		const defs = apiRouter.notificationsAdmin;
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: defs.broadcasts.scopeKey(undefined) }),
			queryClient.invalidateQueries({ queryKey: defs.broadcastReports.scopeKey(undefined) }),
		]);
	}, [queryClient]);
}

/** `/emails/broadcasts` (ADR 073): every broadcast — tenants' and the platform's — with approvals, pauses and reports. */
export function BroadcastsAdminView(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const broadcastsQuery = api.notificationsAdmin.broadcasts.useQuery({ page: 1, limit: LIST_DEFAULT_LIMIT });
	const reportsQuery = api.notificationsAdmin.broadcastReports.useQuery(
		{ page: 1, limit: LIST_DEFAULT_LIMIT, filter: { status: { eq: "OPEN" } } },
		{ enabled: can(PERMISSION.BROADCAST_REPORT.LIST) },
	);

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">Broadcasts</h1>
					<p className="text-sm text-muted-foreground">
						Messages tenants send their customers and notices the platform sends its users. A notice to everyone needs a second person to approve it.
					</p>
				</div>
				{can(PERMISSION.BROADCAST.CREATE) ? (
					<Link href={ROUTES.emails.broadcastNew} className={buttonVariants()}>
						<Plus className="size-4" aria-hidden="true" />
						New broadcast
					</Link>
				) : null}
			</header>
			{can(PERMISSION.BROADCAST_REPORT.LIST) ? <ReportsCard reports={reportsQuery.data?.data} canReview={can(PERMISSION.BROADCAST_REPORT.UPDATE)} /> : null}
			<Card>
				<CardHeader>
					<CardTitle>All broadcasts</CardTitle>
					<CardDescription>Newest first.</CardDescription>
				</CardHeader>
				<CardContent>
					{broadcastsQuery.data === undefined ? (
						<Skeleton className="h-40 w-full" />
					) : broadcastsQuery.data.data.length === 0 ? (
						<p className="text-sm text-muted-foreground">No broadcasts yet.</p>
					) : (
						<ul className="flex flex-col divide-y divide-border">
							{broadcastsQuery.data.data.map((broadcast): React.JSX.Element => (
								<li key={broadcast.id}>
									<BroadcastAdminRow broadcast={broadcast} canApprove={can(PERMISSION.BROADCAST.APPROVE)} canCancel={can(PERMISSION.BROADCAST.DELETE)} />
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

interface BroadcastAdminRowProps {
	readonly broadcast: BroadcastResponse;
	readonly canApprove: boolean;
	readonly canCancel: boolean;
}

function BroadcastAdminRow({ broadcast, canApprove, canCancel }: BroadcastAdminRowProps): React.JSX.Element {
	const { api } = useAuth();
	const invalidate = useInvalidateBroadcasts();
	const [open, setOpen] = React.useState(false);
	const approve = api.notificationsAdmin.approveBroadcast.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Approved", description: "It goes out at its time." });
			await invalidate();
		},
		onError: (error): void => {
			toastMutationError("Could not approve the broadcast", error);
		},
	});
	const cancel = api.notificationsAdmin.cancelBroadcast.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Cancelled", description: "No one else receives it." });
			await invalidate();
		},
		onError: (error): void => {
			toastMutationError("Could not cancel the broadcast", error);
		},
	});
	const { mutate: approveMutate } = approve;
	const { mutate: cancelMutate } = cancel;
	const handleApprove = React.useCallback((): void => {
		approveMutate({ broadcastId: broadcast.id });
	}, [approveMutate, broadcast.id]);
	const handleCancel = React.useCallback((): void => {
		cancelMutate({ broadcastId: broadcast.id });
	}, [broadcast.id, cancelMutate]);
	const handleToggle = React.useCallback((): void => {
		setOpen((current) => !current);
	}, []);
	const cancellable = isBroadcastCancellable(broadcast.status);

	return (
		<div className="flex flex-col gap-3 py-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 flex-col">
					{broadcast.tenantId === null ? (
						<Link href={ROUTES.emails.broadcast(broadcast.id)} className="text-sm font-medium underline-offset-4 hover:underline">
							{broadcast.title}
						</Link>
					) : (
						<span className="text-sm font-medium">{broadcast.title}</span>
					)}
					<span className="text-xs text-muted-foreground">
						{broadcast.tenantId === null ? "Platform notice" : "Tenant broadcast"} · {broadcast.channels.join(", ")}
						{broadcast.audienceCount === null ? "" : ` · ${String(broadcast.audienceCount)} recipients`}
						{broadcast.openReports === 0 ? "" : ` · ${String(broadcast.openReports)} open reports`}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge tone={BROADCAST_STATUS_TONES[broadcast.status]}>{BROADCAST_STATUS_LABELS[broadcast.status]}</StatusBadge>
					<Button type="button" size="sm" variant="ghost" onClick={handleToggle} aria-expanded={open}>
						{open ? "Hide message" : "Read message"}
					</Button>
					{broadcast.status === "PENDING_APPROVAL" && canApprove ? (
						<Button type="button" size="sm" onClick={handleApprove} disabled={approve.isPending}>
							Approve
						</Button>
					) : null}
					{cancellable && canCancel ? (
						<Button type="button" size="sm" variant="outline" onClick={handleCancel} disabled={cancel.isPending}>
							Cancel
						</Button>
					) : null}
				</div>
			</div>
			{open ? (
				<div className="rounded-lg border border-border p-4">
					<RichTextView document={broadcast.body} />
				</div>
			) : null}
		</div>
	);
}

function ReportsCard({ reports, canReview }: { readonly reports: readonly BroadcastReportEntry[] | undefined; readonly canReview: boolean }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Open reports</CardTitle>
				<CardDescription>Recipients who reported a broadcast. Upholding counts a strike against the tenant; three in 90 days switch its broadcasting off.</CardDescription>
			</CardHeader>
			<CardContent>
				{reports === undefined ? (
					<Skeleton className="h-24 w-full" />
				) : reports.length === 0 ? (
					<p className="text-sm text-muted-foreground">Nothing to review.</p>
				) : (
					<ul className="flex flex-col divide-y divide-border">
						{reports.map((report): React.JSX.Element => (
							<li key={report.id}>
								<ReportRow report={report} canReview={canReview} />
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

const REASON_LABELS: Readonly<Record<BroadcastReportEntry["reason"], string>> = { SPAM: "Spam", OFFENSIVE: "Offensive", SCAM: "Scam" };

function ReportRow({ report, canReview }: { readonly report: BroadcastReportEntry; readonly canReview: boolean }): React.JSX.Element {
	const { api } = useAuth();
	const invalidate = useInvalidateBroadcasts();
	const review = api.notificationsAdmin.reviewBroadcastReport.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Report reviewed" });
			await invalidate();
		},
		onError: (error): void => {
			toastMutationError("Could not review the report", error);
		},
	});
	const { mutate } = review;
	const decide = React.useCallback(
		(decision: ReviewBroadcastReportInput["decision"]): void => {
			mutate({ reportId: report.id, decision, note: REVIEW_NOTES[decision] });
		},
		[mutate, report.id],
	);
	const handleDismiss = React.useCallback((): void => {
		decide("dismiss");
	}, [decide]);
	const handleUphold = React.useCallback((): void => {
		decide("uphold");
	}, [decide]);
	const handleResume = React.useCallback((): void => {
		decide("resume");
	}, [decide]);

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 py-3">
			<div className="flex min-w-0 flex-col">
				<span className="text-sm font-medium">
					{REASON_LABELS[report.reason]} · {report.broadcastTitle}
				</span>
				<span className="text-xs text-muted-foreground">
					{report.tenantName ?? "Platform"} · {report.tenantStrikesInWindow} strikes in 90 days{report.note === null ? "" : ` · “${report.note}”`}
				</span>
			</div>
			{canReview ? (
				<div className="flex flex-wrap gap-2">
					<Button type="button" size="sm" variant="outline" onClick={handleDismiss} disabled={review.isPending}>
						Dismiss
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={handleResume} disabled={review.isPending}>
						Resume broadcast
					</Button>
					<Button type="button" size="sm" variant="destructive" onClick={handleUphold} disabled={review.isPending}>
						Uphold
					</Button>
				</div>
			) : null}
		</div>
	);
}
