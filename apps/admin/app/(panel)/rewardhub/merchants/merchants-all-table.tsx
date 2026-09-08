"use client";

import { invalidateSessionAuth } from "@workspace/client/lib/auth/invalidate-session-auth";
import { createDataTableLabels } from "@/lib/data-table-labels";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table-capabilities";
import { DataTableMobileCard } from "@/lib/data-table-mobile-card";
import { readPaginatedNextCursor, readPaginatedTotal, stubPaginatedMeta } from "@/lib/api-envelope";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useManualHybridPagination } from "@/lib/use-manual-cursor-pagination";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { useAuth } from "@workspace/client/lib/auth";
import type { MerchantOrgResponse } from "@workspace/shared";
import { KybStatusSchema, MerchantOrgStatusSchema } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface MerchantsAllTableProps {
	readonly initialMerchants?: readonly MerchantOrgResponse[];
	readonly initialTotal?: number;
	readonly initialTotalPages?: number;
	readonly initialHasNext?: boolean;
}

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

export default function MerchantsAllTable({ initialMerchants, initialTotal, initialTotalPages, initialHasNext }: MerchantsAllTableProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const [search, setSearch] = React.useState("");
	const [kybStatusFilter, setKybStatusFilter] = React.useState<string>("all");
	const [statusFilter, setStatusFilter] = React.useState<string>("all");
	const debouncedSearch = useDebouncedValue(search, 300);

	const trimmedSearch = debouncedSearch.trim();
	const parsedKybStatus = kybStatusFilter === "all" ? undefined : KybStatusSchema.safeParse(kybStatusFilter).data;
	const parsedOrgStatus = statusFilter === "all" ? undefined : MerchantOrgStatusSchema.safeParse(statusFilter).data;
	const isFiltered = trimmedSearch.length > 0 || kybStatusFilter !== "all" || statusFilter !== "all";

	const handleClearFilters = React.useCallback((): void => {
		setSearch("");
		setKybStatusFilter("all");
		setStatusFilter("all");
	}, []);

	const {
		pageIndex,
		pageSize,
		listQuery,
		bindListMeta,
		pagination: basePagination,
	} = useManualHybridPagination<MerchantOrgResponse>(20, [debouncedSearch, kybStatusFilter, statusFilter], (merchant) => merchant.id, {
		onClearFilters: handleClearFilters,
		isFiltered,
	});

	const initialQueryData = React.useMemo(
		() =>
			initialMerchants !== undefined
				? {
						success: true as const,
						data: [...initialMerchants],
						meta: stubPaginatedMeta(20, initialTotal ?? initialMerchants.length, 1, initialTotalPages ?? 1, initialHasNext ?? false),
					}
				: undefined,
		[initialMerchants, initialHasNext, initialTotal, initialTotalPages],
	);

	const merchantsQuery = api.rewardsAdmin.listMerchants.useQuery(
		{
			...listQuery,
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
			...(parsedKybStatus !== undefined ? { kybStatus: parsedKybStatus } : {}),
			...(parsedOrgStatus !== undefined ? { status: parsedOrgStatus } : {}),
		},
		{
			placeholderData: keepPreviousData,
			initialData: pageIndex === 0 && pageSize === 20 && trimmedSearch.length === 0 && kybStatusFilter === "all" && statusFilter === "all" ? initialQueryData : undefined,
		},
	);

	const rows: readonly MerchantOrgResponse[] = merchantsQuery.data?.data ?? [];
	const totalCount = readPaginatedTotal(merchantsQuery.data?.meta, initialTotal ?? initialMerchants?.length ?? 0);
	const pagination = React.useMemo(() => ({ ...basePagination, totalCount }), [basePagination, totalCount]);

	React.useEffect((): void => {
		bindListMeta(readPaginatedNextCursor(merchantsQuery.data?.meta) ?? null);
	}, [bindListMeta, merchantsQuery.data?.meta]);
	const tableError: string | null = merchantsQuery.isError ? "Could not load merchants. Clear search and try again." : null;

	const handleReviewKyb = React.useCallback(
		(merchant: MerchantOrgResponse): void => {
			router.push(`/rewardhub/kyb?merchantOrgId=${merchant.id}`);
		},
		[router],
	);

	const impersonateMutation = api.auth.impersonate.useMutation({
		onSuccess: async (): Promise<void> => {
			await invalidateSessionAuth(queryClient);
		},
	});

	const meQuery = api.auth.me.useQuery(undefined);
	const permissionsQuery = api.auth.permissions.useQuery(undefined);
	const currentUser = meQuery.data?.data;
	const session = permissionsQuery.data?.data;
	const isImpersonating = session?.isImpersonating === true;
	const canImpersonateOwner = currentUser?.isSuperAdmin === true && !isImpersonating;

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
				label: "Review KYB",
				description: "Update verification status",
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
	}, [canImpersonateOwner, handleImpersonateOwner, handleReviewKyb]);

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

	const handleManualColumnFilterChange = React.useCallback((filterKey: string, value: string | null): void => {
		const next = value === null || value === "all" ? "all" : value;
		if (filterKey === "kybStatus") {
			setKybStatusFilter(next);
		}
		if (filterKey === "status") {
			setStatusFilter(next);
		}
	}, []);

	const manualColumnFilters = React.useMemo(
		(): Readonly<Record<string, string>> => ({
			kybStatus: kybStatusFilter,
			status: statusFilter,
		}),
		[kybStatusFilter, statusFilter],
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

	const handleSearchChange = React.useCallback((value: string): void => {
		setSearch(value);
	}, []);

	const toolbarContent = React.useMemo(
		() => <DataTableSearchToolbar value={search} onChange={handleSearchChange} placeholder={tableLabels.searchPlaceholder} ariaLabel={tableLabels.searchAriaLabel} />,
		[handleSearchChange, search, tableLabels.searchAriaLabel, tableLabels.searchPlaceholder],
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
						pageSizeOptions={PAGE_SIZE_OPTIONS}
						error={tableError}
						isLoading={merchantsQuery.isLoading}
						isRefetching={merchantsQuery.isFetching && !merchantsQuery.isLoading ? true : false}
						toolbarContent={toolbarContent}
					/>
					<p className="mt-4 text-xs text-muted-foreground">
						Need KYB? Open a row action or go to{" "}
						<Link href="/rewardhub/kyb" className="text-primary hover:underline">
							KYB review
						</Link>
						.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
