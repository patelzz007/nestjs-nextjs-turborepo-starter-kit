"use client";

import type { AdminMfaRecoveryRequest, MfaRecoveryRecordStatus } from "@workspace/shared";
import { readPaginatedTotal, stubPaginatedMeta } from "@/lib/api-envelope";
import { createDataTableLabels } from "@/lib/data-table-labels";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table-capabilities";
import { DataTableMobileCard } from "@/lib/data-table-mobile-card";
import { formatDateTimeWithSeconds } from "@/lib/dates";
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

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];
const STATUS_FILTER_OPTIONS: readonly { readonly value: "all" | MfaRecoveryRecordStatus; readonly label: string }[] = [
	{ value: "all", label: "All statuses" },
	{ value: "PENDING", label: "Pending review" },
	{ value: "APPROVED", label: "Approved" },
	{ value: "DENIED", label: "Denied" },
	{ value: "COMPLETED", label: "Completed" },
];

export interface MfaRecoveryQueueProps {
	readonly initialRequests?: readonly AdminMfaRecoveryRequest[];
	readonly initialTotal?: number;
	readonly initialStatus?: MfaRecoveryRecordStatus;
}

export const MfaRecoveryQueue = React.forwardRef<HTMLDivElement, MfaRecoveryQueueProps>(function MfaRecoveryQueue(
	{ initialRequests, initialTotal, initialStatus },
	ref,
): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const [page, setPage] = React.useState(1);
	const [pageLimit, setPageLimit] = React.useState(20);
	const [statusFilter, setStatusFilter] = React.useState<"all" | MfaRecoveryRecordStatus>(initialStatus ?? "PENDING");
	const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null);

	const statusParam: MfaRecoveryRecordStatus | undefined = statusFilter === "all" ? undefined : statusFilter;

	const requestsQuery = api.auth.adminMfaRecoveryRequests.useQuery(
		{ page, limit: pageLimit, status: statusParam },
		{
			placeholderData: keepPreviousData,
			initialData:
				initialRequests !== undefined && initialTotal !== undefined
					? {
							success: true,
							data: [...initialRequests],
							meta: stubPaginatedMeta(initialTotal, page, pageLimit),
						}
					: undefined,
		},
	);

	const rows = React.useMemo((): readonly AdminMfaRecoveryRequest[] => requestsQuery.data?.data ?? [], [requestsQuery.data?.data]);
	const total: number = readPaginatedTotal(requestsQuery.data?.meta, initialTotal ?? rows.length);
	const selectedRequest: AdminMfaRecoveryRequest | undefined = rows.find((row) => row.id === selectedRequestId) ?? rows[0];

	React.useEffect((): void => {
		if (rows.length === 0) {
			setSelectedRequestId(null);
			return;
		}
		if (selectedRequestId === null || !rows.some((row) => row.id === selectedRequestId)) {
			setSelectedRequestId(rows[0]?.id ?? null);
		}
	}, [rows, selectedRequestId]);

	const handleManualColumnFilterChange = React.useCallback((filterKey: string, value: string | null): void => {
		if (filterKey !== "status") {
			return;
		}
		const next = value === null || value === "all" ? "all" : value;
		if (next === "all" || next === "PENDING" || next === "APPROVED" || next === "DENIED" || next === "COMPLETED") {
			setStatusFilter(next);
			setPage(1);
		}
	}, []);

	const manualColumnFilters = React.useMemo(
		(): Readonly<Record<string, string>> => ({
			status: statusFilter,
		}),
		[statusFilter],
	);

	const tableFilters = React.useMemo(
		(): Filter[] => [
			{
				key: "status",
				label: "Status",
				options: STATUS_FILTER_OPTIONS.filter((option) => option.value !== "all").map((option) => ({
					value: option.value,
					label: option.label,
				})),
			},
		],
		[],
	);

	const checkbox = React.useMemo(
		() => buildReadOnlyTableCheckbox("mfa-recovery-requests.csv", ["userFullName", "userEmail", "status", "requestedAt"]),
		[],
	);

	const tableLabels = React.useMemo(
		() =>
			createDataTableLabels({
				actionsMenuTitle: "Recovery request actions",
				openRowMenu: "Open recovery request row menu",
			}),
		[],
	);

	const handleManualPaginationChange = React.useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage + 1);
		setPageLimit(nextPageSize);
	}, []);

	const handleRowClick = React.useCallback((row: AdminMfaRecoveryRequest): void => {
		setSelectedRequestId(row.id);
	}, []);

	const handleReviewed = React.useCallback((): void => {
		void requestsQuery.refetch();
	}, [requestsQuery]);

	const handleViewUser = React.useCallback(
		(request: AdminMfaRecoveryRequest): void => {
			router.push(`/users/${request.userId}`);
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
					<Link href={`/users/${row.original.userId}`} className="text-sm text-primary underline-offset-4 hover:underline">
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
					{statusFilter === "PENDING" && total > 0 ? <Badge variant="secondary">{total} pending</Badge> : null}
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
						manual
						totalCount={total}
						pageIndex={page - 1}
						pageSize={pageLimit}
						pageSizeOptions={PAGE_SIZE_OPTIONS}
						isLoading={requestsQuery.isLoading}
						isRefetching={requestsQuery.isFetching && !requestsQuery.isLoading ? true : false}
						onManualPaginationChange={handleManualPaginationChange}
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
