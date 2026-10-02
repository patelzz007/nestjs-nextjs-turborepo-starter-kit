"use client";

import { adminMfaRecoveryListQuery, type AdminMfaRecoveryRequest, type Envelope, type MfaRecoveryRecordStatus } from "@workspace/shared";
import { ALL_FILTER_OPTION } from "@workspace/client/lib/api/list-query";
import { initialDataOption, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { MFA_RECOVERY_PAGE_SIZE_OPTIONS, MFA_RECOVERY_URL_STATE, MfaRecoveryStatusFilterSchema, toMfaRecoveryListQuery } from "@/lib/url-state/mfa-recovery";
import { createDataTableLabels } from "@/lib/data-table/labels";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table/capabilities";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { MfaRecoveryReviewPanel } from "@/components/security/mfa-recovery-review-panel";
import { MfaRecoveryStatusBadge } from "@/components/security/mfa-recovery-status-badge";
import { useAuth } from "@workspace/client/lib/auth";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import * as React from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ROUTES } from "@/lib/routes";

const STATUS_FILTER_OPTIONS: readonly { readonly value: MfaRecoveryRecordStatus; readonly label: string }[] = [
	{ value: "PENDING", label: "Pending review" },
	{ value: "APPROVED", label: "Approved" },
	{ value: "DENIED", label: "Denied" },
	{ value: "COMPLETED", label: "Completed" },
];

export interface MfaRecoveryQueueProps {
	/** The page the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<Envelope<AdminMfaRecoveryRequest[]>> | undefined;
}

/**
 * Super-admin MFA recovery queue. The status filter (pending by default), page
 * and the request open in the review panel (`?requestId=`) live in the URL
 * (lib/url-state/mfa-recovery), so a link from an email or a colleague opens
 * the same request; without one, the first request on the page is shown.
 */
export const MfaRecoveryQueue = React.forwardRef<HTMLDivElement, MfaRecoveryQueueProps>(function MfaRecoveryQueue({ initialPage }, ref): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const [urlState, updateUrlState] = useUrlState(MFA_RECOVERY_URL_STATE);
	const statusFilter = urlState.status;
	const isFiltered = statusFilter !== ALL_FILTER_OPTION;

	const handleClearFilters = React.useCallback((): void => {
		updateUrlState({ status: ALL_FILTER_OPTION, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	const stateKey: string = MFA_RECOVERY_URL_STATE.serialize({ ...urlState, requestId: undefined });
	const requestsQuery = api.auth.adminMfaRecoveryRequests.useQuery(toMfaRecoveryListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});

	const rows = React.useMemo((): readonly AdminMfaRecoveryRequest[] => requestsQuery.data?.data ?? [], [requestsQuery.data?.data]);
	const { pagination } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: adminMfaRecoveryListQuery,
		totalCount: readPaginatedTotal(requestsQuery.data?.meta),
		nextCursor: readPaginatedNextCursor(requestsQuery.data?.meta),
		resetKey: MFA_RECOVERY_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined, requestId: undefined }),
		getRowId: getRequestRowId,
		onClearFilters: handleClearFilters,
		isFiltered,
	});

	// Derived, not synced: the URL's request when it is on this page, else the first row.
	const selectedRequest: AdminMfaRecoveryRequest | undefined = rows.find((row) => row.id === urlState.requestId) ?? rows[0];

	const handleManualColumnFilterChange = React.useCallback(
		(filterKey: string, value: string | null): void => {
			if (filterKey !== "status") {
				return;
			}
			const parsed = MfaRecoveryStatusFilterSchema.safeParse(value ?? ALL_FILTER_OPTION);
			updateUrlState({ status: parsed.success ? parsed.data : ALL_FILTER_OPTION, page: LIST_FIRST_PAGE, cursor: undefined, requestId: undefined });
		},
		[updateUrlState],
	);

	const manualColumnFilters = React.useMemo((): Readonly<Record<string, string>> => ({ status: statusFilter }), [statusFilter]);

	const tableFilters = React.useMemo(
		(): Filter[] => [
			{
				key: "status",
				label: "Status",
				options: STATUS_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
			},
		],
		[],
	);

	const checkbox = React.useMemo(() => buildReadOnlyTableCheckbox("mfa-recovery-requests.csv", ["userFullName", "userEmail", "status", "requestedAt"]), []);

	const tableLabels = React.useMemo(
		() =>
			createDataTableLabels({
				actionsMenuTitle: "Recovery request actions",
				openRowMenu: "Open recovery request row menu",
			}),
		[],
	);

	const handleRowClick = React.useCallback(
		(row: AdminMfaRecoveryRequest): void => {
			updateUrlState({ requestId: row.id });
		},
		[updateUrlState],
	);

	const handleReviewed = React.useCallback((): void => {
		void requestsQuery.refetch();
	}, [requestsQuery]);

	const handleViewUser = React.useCallback(
		(request: AdminMfaRecoveryRequest): void => {
			router.push(ROUTES.users.detail(request.userId));
		},
		[router],
	);

	const actions = React.useMemo((): Action<AdminMfaRecoveryRequest>[] => {
		return [
			{
				key: "view",
				label: "View user",
				description: "Open the user profile",
				icon: <Eye className="size-4" />,
				onClick: handleViewUser,
			},
		];
	}, [handleViewUser]);

	const mobileCardRender = React.useCallback(
		(request: AdminMfaRecoveryRequest, cardActions?: Action<AdminMfaRecoveryRequest>[]): React.ReactNode => (
			<DataTableMobileCard
				item={request}
				title={request.userFullName}
				subtitle={request.userEmail}
				badge={<MfaRecoveryStatusBadge status={request.status} />}
				fields={[{ label: "Requested", value: formatDateTimeWithSeconds(request.requestedAt) }]}
				actions={cardActions}
			/>
		),
		[],
	);

	const columns = React.useMemo((): ColumnDef<DataTableFeatures, AdminMfaRecoveryRequest>[] => {
		return [
			{
				id: "user",
				header: "User",
				cell: ({ row }) => (
					<div className="min-w-0">
						<p className="truncate font-medium">{row.original.userFullName}</p>
						<p className="truncate text-xs text-muted-foreground">{row.original.userEmail}</p>
					</div>
				),
			},
			{
				id: "status",
				header: "Status",
				cell: ({ row }) => <MfaRecoveryStatusBadge status={row.original.status} />,
			},
			{
				id: "requestedAt",
				header: "Requested",
				cell: ({ row }) => <span className="text-sm">{formatDateTimeWithSeconds(row.original.requestedAt)}</span>,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<Link href={ROUTES.users.detail(row.original.userId)} className="text-sm text-primary underline-offset-4 hover:underline">
						View user
					</Link>
				),
			},
		];
	}, []);

	return (
		<div ref={ref} className="space-y-6">
			<Card>
				<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<CardTitle>MFA recovery queue</CardTitle>
						<CardDescription>Review requests from users who lost access to their authenticator and backup codes.</CardDescription>
					</div>
					{statusFilter === "PENDING" && rows.length > 0 ? <Badge variant="secondary">{String(rows.length)} pending on this page</Badge> : null}
				</CardHeader>
				<CardContent className="space-y-6">
					<DataTable
						columns={columns}
						data={[...rows]}
						labels={tableLabels}
						actions={actions}
						checkbox={checkbox}
						enableColumnVisibility
						filters={tableFilters}
						manualColumnFilters={manualColumnFilters}
						onManualColumnFilterChange={handleManualColumnFilterChange}
						mobileCardRender={mobileCardRender}
						pagination={pagination}
						pageSizeOptions={MFA_RECOVERY_PAGE_SIZE_OPTIONS}
						isLoading={requestsQuery.isLoading}
						isRefetching={requestsQuery.isFetching && !requestsQuery.isLoading ? true : false}
						onRowClick={handleRowClick}
						emptyState={{
							title: "No requests",
							description: "No MFA recovery requests match this filter.",
						}}
					/>
				</CardContent>
			</Card>

			{selectedRequest !== undefined ? (
				<section className="space-y-3">
					<h2 className="text-lg font-semibold">Review request</h2>
					<MfaRecoveryReviewPanel request={selectedRequest} onReviewed={handleReviewed} />
				</section>
			) : null}
		</div>
	);
});

function getRequestRowId(request: AdminMfaRecoveryRequest): string {
	return request.id;
}
