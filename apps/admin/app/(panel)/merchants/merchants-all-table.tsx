"use client";

import { invalidateSessionAuth } from "@workspace/client/lib/auth/session/invalidate-auth";
import { createDataTableLabels } from "@/lib/data-table/labels";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table/capabilities";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { initialDataOption, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useTableTextDraft } from "@/lib/data-table/use-table-text-draft";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { MERCHANTS_PAGE_SIZE_OPTIONS, MERCHANTS_TABLE_URL_STATE, toMerchantsListQuery } from "@/lib/url-state/merchants";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import type { Envelope, MerchantOrgResponse } from "@workspace/shared";
import { adminMerchantListQuery, KybStatusSchema, MerchantOrgStatusSchema, PERMISSION } from "@workspace/shared";
import { ALL_FILTER_OPTION, parseFilterOption, toListSearch } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { useCanStartImpersonation } from "@/lib/session/super-admin";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ROUTES } from "@/lib/routes";

export interface MerchantsAllTableProps {
	/** The page the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<Envelope<MerchantOrgResponse[]>> | undefined;
}

/**
 * `/merchants` table. Search, KYB / org status filters and page live in the
 * URL (lib/url-state/merchants); the only local state is the search draft.
 */
export default function MerchantsAllTable({ initialPage }: MerchantsAllTableProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const queryClient = useQueryClient();
	const router = useRouter();
	const [urlState, updateUrlState] = useUrlState(MERCHANTS_TABLE_URL_STATE);
	const isFiltered = urlState.search !== undefined || urlState.kybStatus !== undefined || urlState.status !== undefined;

	const commitSearch = React.useCallback(
		(value: string): void => {
			updateUrlState({ search: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const [searchDraft, setSearchDraft] = useTableTextDraft(urlState.search, commitSearch);

	const handleClearFilters = React.useCallback((): void => {
		updateUrlState({ search: undefined, kybStatus: undefined, status: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	const stateKey: string = MERCHANTS_TABLE_URL_STATE.serialize(urlState);
	const merchantsQuery = api.rewardsAdmin.listOrganizations.useQuery(toMerchantsListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});

	const rows: readonly MerchantOrgResponse[] = merchantsQuery.data?.data ?? [];
	const { pagination } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: adminMerchantListQuery,
		totalCount: readPaginatedTotal(merchantsQuery.data?.meta),
		nextCursor: readPaginatedNextCursor(merchantsQuery.data?.meta),
		resetKey: MERCHANTS_TABLE_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined }),
		getRowId: getMerchantRowId,
		onClearFilters: handleClearFilters,
		isFiltered,
	});
	const tableError: string | null = merchantsQuery.isError ? "Could not load merchants. Clear search and try again." : null;

	const handleReviewKyb = React.useCallback(
		(merchant: MerchantOrgResponse): void => {
			router.push(ROUTES.merchants.verificationFor(merchant.id));
		},
		[router],
	);

	const impersonateMutation = api.auth.impersonate.useMutation({
		onSuccess: async (): Promise<void> => {
			await invalidateSessionAuth(queryClient);
		},
	});

	// `PATCH /admin/merchants/:id/kyb` needs MANAGE; viewing the KYB page only LIST.
	const canManageKyb = can(PERMISSION.MERCHANT_ORG.MANAGE);
	// `POST /auth/impersonate/:userId` is `@SuperAdminOnly`.
	const canImpersonateOwner = useCanStartImpersonation();

	const handleImpersonateOwner = React.useCallback(
		(merchant: MerchantOrgResponse): void => {
			if (merchant.ownerUserId === undefined || merchant.ownerUserId === null) {
				return;
			}
			void impersonateMutation.mutateAsync({ userId: merchant.ownerUserId });
		},
		[impersonateMutation],
	);

	const actions = React.useMemo((): Action<MerchantOrgResponse>[] => {
		const base: Action<MerchantOrgResponse>[] = [
			{
				key: "kyb",
				label: canManageKyb ? "Review KYB" : "View KYB",
				description: canManageKyb ? "Update verification status" : "Inspect verification details",
				icon: <ShieldCheck className="size-4" />,
				onClick: handleReviewKyb,
			},
		];

		if (canImpersonateOwner) {
			base.push({
				key: "impersonate-owner",
				label: "Impersonate owner",
				description: "Super-admin: switch admin session to merchant owner",
				icon: <ShieldCheck className="size-4" />,
				onClick: handleImpersonateOwner,
			});
		}

		return base;
	}, [canImpersonateOwner, canManageKyb, handleImpersonateOwner, handleReviewKyb]);

	const mobileCardRender = React.useCallback(
		(merchant: MerchantOrgResponse, cardActions?: Action<MerchantOrgResponse>[]): React.ReactNode => (
			<DataTableMobileCard
				item={merchant}
				title={merchant.businessName}
				subtitle={merchant.contactEmail}
				badge={<Badge variant="outline">{merchant.kybStatus}</Badge>}
				fields={[
					{ label: "City", value: merchant.city.replace("_", " ") },
					{ label: "Category", value: merchant.category },
					{ label: "Status", value: merchant.status },
				]}
				actions={cardActions}
			/>
		),
		[],
	);

	const columns = React.useMemo((): ColumnDef<DataTableFeatures, MerchantOrgResponse>[] => {
		return [
			{
				id: "businessName",
				header: "Business",
				cell: ({ row }) => <span className="font-medium">{row.original.businessName}</span>,
			},
			{
				id: "city",
				header: "City",
				cell: ({ row }) => <span className="text-muted-foreground">{row.original.city.replace("_", " ")}</span>,
			},
			{
				id: "category",
				header: "Category",
				cell: ({ row }) => <span>{row.original.category}</span>,
			},
			{
				id: "contact",
				header: "Contact",
				cell: ({ row }) => <span className="text-muted-foreground">{row.original.contactEmail}</span>,
			},
			{
				id: "kyb",
				header: "KYB",
				cell: ({ row }) => <Badge variant="outline">{row.original.kybStatus}</Badge>,
			},
			{
				id: "status",
				header: "Status",
				cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
			},
		];
	}, []);

	const tableLabels = React.useMemo(
		() =>
			createDataTableLabels({
				actionsMenuTitle: "Merchant actions",
				openRowMenu: "Open merchant row menu",
				searchPlaceholder: "Search name or email…",
			}),
		[],
	);

	const handleManualColumnFilterChange = React.useCallback(
		(filterKey: string, value: string | null): void => {
			if (filterKey === "kybStatus") {
				updateUrlState({ kybStatus: parseFilterOption(value ?? "", KybStatusSchema), page: LIST_FIRST_PAGE, cursor: undefined });
			}
			if (filterKey === "status") {
				updateUrlState({ status: parseFilterOption(value ?? "", MerchantOrgStatusSchema), page: LIST_FIRST_PAGE, cursor: undefined });
			}
		},
		[updateUrlState],
	);

	const manualColumnFilters = React.useMemo(
		(): Readonly<Record<string, string>> => ({
			kybStatus: urlState.kybStatus ?? ALL_FILTER_OPTION,
			status: urlState.status ?? ALL_FILTER_OPTION,
		}),
		[urlState.kybStatus, urlState.status],
	);

	const tableFilters = React.useMemo(
		(): Filter[] => [
			{
				key: "kybStatus",
				label: "KYB status",
				options: [
					{ value: "PENDING", label: "Pending" },
					{ value: "APPROVED", label: "Approved" },
					{ value: "REJECTED", label: "Rejected" },
				],
			},
			{
				key: "status",
				label: "Org status",
				options: [
					{ value: "ONBOARDING", label: "Onboarding" },
					{ value: "ACTIVE", label: "Active" },
					{ value: "SUSPENDED", label: "Suspended" },
				],
			},
		],
		[],
	);

	const checkbox = React.useMemo(() => buildReadOnlyTableCheckbox("merchants.csv", ["businessName", "city", "category", "contactEmail", "kybStatus", "status"]), []);

	const toolbarContent = React.useMemo(
		() => <DataTableSearchToolbar value={searchDraft} onChange={setSearchDraft} placeholder={tableLabels.searchPlaceholder} ariaLabel={tableLabels.searchAriaLabel} />,
		[searchDraft, setSearchDraft, tableLabels.searchAriaLabel, tableLabels.searchPlaceholder],
	);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Merchants</h1>
				<p className="text-sm text-muted-foreground">Merchant organizations onboarded in the rewards pilot.</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">{rows.length > 0 ? `${String(rows.length)} merchants on this page` : "Merchant organizations"}</CardTitle>
				</CardHeader>
				<CardContent>
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
						pageSizeOptions={MERCHANTS_PAGE_SIZE_OPTIONS}
						error={tableError}
						isLoading={merchantsQuery.isLoading}
						isRefetching={merchantsQuery.isFetching && !merchantsQuery.isLoading ? true : false}
						toolbarContent={toolbarContent}
					/>
					<p className="mt-4 text-xs text-muted-foreground">
						Need KYB? Open a row action or go to{" "}
						<Link href={ROUTES.merchants.verification} className="text-primary hover:underline">
							Verification
						</Link>
						.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

function getMerchantRowId(merchant: MerchantOrgResponse): string {
	return merchant.id;
}
