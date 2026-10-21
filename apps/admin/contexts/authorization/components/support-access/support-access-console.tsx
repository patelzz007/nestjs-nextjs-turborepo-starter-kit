"use client";

import {
	supportAccessGrantListQuery,
	SupportAccessGrantStatusSchema,
	type Envelope,
	type SupportAccessGrantDetail,
	type SupportAccessGrantRequestInput,
	type SupportAccessGrantStatus,
} from "@workspace/shared";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { ALL_FILTER_OPTION } from "@workspace/client/lib/api/list-query";
import { initialDataOption, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { DataTable, type DataTableFeatures, type Filter } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table/capabilities";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";

import { SUPPORT_ACCESS_PAGE_SIZE_OPTIONS, SUPPORT_ACCESS_URL_STATE, toSupportAccessListQuery } from "../../url-state/support-access";
import { SupportAccessRequestForm } from "./support-access-request-form";

/** Display label of every grant status — the filter's options are the shared enum. */
export const SUPPORT_ACCESS_STATUS_LABELS: Readonly<Record<SupportAccessGrantStatus, string>> = {
	PENDING_APPROVAL: "Pending approval",
	PENDING_TENANT_APPROVAL: "Waiting for the owner",
	ACTIVE: "Active",
	EXPIRED: "Expired",
	REVOKED: "Revoked",
	DENIED: "Denied",
};

/** Statuses a grant can still be revoked from (the API's own table). */
const REVOCABLE: ReadonlySet<SupportAccessGrantStatus> = new Set<SupportAccessGrantStatus>(["PENDING_APPROVAL", "PENDING_TENANT_APPROVAL", "ACTIVE"]);

export function isRevocable(grant: SupportAccessGrantDetail): boolean {
	return REVOCABLE.has(grant.status);
}

const TABLE_LABELS: UiKitLabelsOverride<"dataTable"> = {
	actionsMenuTitle: "Grant actions",
	openRowMenu: "Open grant row menu",
};

function grantRowId(grant: SupportAccessGrantDetail): string {
	return grant.id;
}

interface RevokeGrantButtonProps {
	readonly grant: SupportAccessGrantDetail;
	readonly onRevoke: (input: { readonly grantId: string }) => void;
	readonly disabled: boolean;
}

function RevokeGrantButton({ grant, onRevoke, disabled }: RevokeGrantButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onRevoke({ grantId: grant.id });
	}, [grant.id, onRevoke]);
	return (
		<Button type="button" size="sm" variant="outline" onClick={handleClick} disabled={disabled} aria-label={`Revoke access to ${grant.tenant.displayName}`}>
			Revoke
		</Button>
	);
}

export interface SupportAccessConsoleProps {
	/** The page the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<Envelope<SupportAccessGrantDetail[]>> | undefined;
}

/**
 * `/users/support-access`: request just-in-time access to a tenant (its owner approves it in the
 * merchant portal), and every grant with its state; a grant that is not over yet can be revoked.
 * The list's filter and page live in the URL.
 */
export const SupportAccessConsole = React.forwardRef<HTMLDivElement, SupportAccessConsoleProps>(function SupportAccessConsole({ initialPage }, ref): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [urlState, updateUrlState] = useUrlState(SUPPORT_ACCESS_URL_STATE);
	const statusFilter = urlState.status;

	const stateKey: string = SUPPORT_ACCESS_URL_STATE.serialize(urlState);
	const grantsQuery = api.supportAccess.list.useQuery(toSupportAccessListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});
	const isRefetching: boolean = grantsQuery.isFetching && !grantsQuery.isLoading;
	const rows = React.useMemo((): readonly SupportAccessGrantDetail[] => grantsQuery.data?.data ?? [], [grantsQuery.data?.data]);

	const refreshGrants = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.supportAccess.list.scopeKey(undefined) });
	}, [queryClient]);

	const requestGrant = api.supportAccess.request.useMutation();
	const revokeGrant = api.supportAccess.revoke.useMutation({
		onSuccess: async () => {
			await refreshGrants();
			toastMessage.success({ title: "Support access revoked" });
		},
		onError: (error) => {
			toastMutationError("Could not revoke the grant", error);
		},
	});
	const { mutate: revoke } = revokeGrant;

	const handleRequest = React.useCallback(
		async (request: SupportAccessGrantRequestInput): Promise<void> => {
			try {
				await requestGrant.mutateAsync(request);
				await refreshGrants();
				toastMessage.success({ title: "Access requested", description: "The merchant's owner must approve it before it works." });
			} catch (error) {
				if (error instanceof Error) {
					toastMutationError("Could not request access", error);
				}
				throw error;
			}
		},
		[refreshGrants, requestGrant],
	);

	const handleClearFilters = React.useCallback((): void => {
		updateUrlState({ status: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	const { pagination } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: supportAccessGrantListQuery,
		totalCount: readPaginatedTotal(grantsQuery.data?.meta),
		nextCursor: readPaginatedNextCursor(grantsQuery.data?.meta),
		resetKey: SUPPORT_ACCESS_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined }),
		getRowId: grantRowId,
		onClearFilters: handleClearFilters,
		isFiltered: statusFilter !== undefined,
	});

	const handleManualColumnFilterChange = React.useCallback(
		(filterKey: string, value: string | null): void => {
			if (filterKey !== "status") {
				return;
			}
			const parsed = SupportAccessGrantStatusSchema.safeParse(value);
			updateUrlState({ status: parsed.success ? parsed.data : undefined, page: LIST_FIRST_PAGE, cursor: undefined });
		},
		[updateUrlState],
	);
	const manualColumnFilters = React.useMemo((): Readonly<Record<string, string>> => ({ status: statusFilter ?? ALL_FILTER_OPTION }), [statusFilter]);
	const tableFilters = React.useMemo(
		(): Filter[] => [
			{ key: "status", label: "Status", options: SupportAccessGrantStatusSchema.options.map((status) => ({ value: status, label: SUPPORT_ACCESS_STATUS_LABELS[status] })) },
		],
		[],
	);
	const checkbox = React.useMemo(() => buildReadOnlyTableCheckbox("support-access-grants.csv", ["status", "mode", "expiresAt", "createdAt"]), []);

	const mobileCardRender = React.useCallback(
		(grant: SupportAccessGrantDetail): React.ReactNode => (
			<DataTableMobileCard
				item={grant}
				title={grant.tenant.displayName}
				subtitle={grant.supportUser?.email ?? "—"}
				badge={<Badge variant={grant.status === "ACTIVE" ? "default" : "outline"}>{SUPPORT_ACCESS_STATUS_LABELS[grant.status]}</Badge>}
				fields={[{ label: "Expires", value: formatDateTimeWithSeconds(grant.expiresAt) }]}
			/>
		),
		[],
	);

	const columns = React.useMemo(
		(): ColumnDef<DataTableFeatures, SupportAccessGrantDetail>[] => [
			{
				id: "tenant",
				header: "Merchant",
				cell: ({ row }) => <span className="font-medium">{row.original.tenant.displayName}</span>,
			},
			{
				id: "supportUser",
				header: "For",
				cell: ({ row }) => <span className="text-sm">{row.original.supportUser?.fullName ?? "Former account"}</span>,
			},
			{
				id: "status",
				header: "Status",
				cell: ({ row }) => <Badge variant={row.original.status === "ACTIVE" ? "default" : "outline"}>{SUPPORT_ACCESS_STATUS_LABELS[row.original.status]}</Badge>,
			},
			{
				id: "mode",
				header: "Access",
				cell: ({ row }) => <span className="text-sm">{row.original.mode === "READ_ONLY" ? "Read only" : "Read and write"}</span>,
			},
			{
				id: "reason",
				header: "Reason",
				cell: ({ row }) => <span className="line-clamp-2 text-sm">{row.original.reason}</span>,
			},
			{
				id: "expiresAt",
				header: "Expires",
				cell: ({ row }) => <span className="text-sm">{formatDateTimeWithSeconds(row.original.expiresAt)}</span>,
			},
			{
				id: "revoke",
				header: "",
				cell: ({ row }) => (isRevocable(row.original) ? <RevokeGrantButton grant={row.original} onRevoke={revoke} disabled={revokeGrant.isPending} /> : null),
			},
		],
		[revoke, revokeGrant.isPending],
	);

	return (
		<div ref={ref} className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Request access</CardTitle>
					<CardDescription>Ask a merchant for time-boxed access to its data. Nothing works until its owner approves the request.</CardDescription>
				</CardHeader>
				<CardContent>
					<SupportAccessRequestForm isPending={requestGrant.isPending} onRequest={handleRequest} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Grants</CardTitle>
					<CardDescription>Every support access grant, newest first. A grant ends when it expires or is revoked.</CardDescription>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={columns}
						data={rows}
						labels={TABLE_LABELS}
						checkbox={checkbox}
						enableColumnVisibility
						filters={tableFilters}
						manualColumnFilters={manualColumnFilters}
						onManualColumnFilterChange={handleManualColumnFilterChange}
						mobileCardRender={mobileCardRender}
						pagination={pagination}
						pageSizeOptions={SUPPORT_ACCESS_PAGE_SIZE_OPTIONS}
						isLoading={grantsQuery.isLoading}
						isRefetching={isRefetching}
						emptyState={{ title: "No grants", description: "No support access grants match this filter." }}
					/>
				</CardContent>
			</Card>
		</div>
	);
});
