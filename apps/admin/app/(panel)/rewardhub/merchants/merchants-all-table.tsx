"use client";

import { invalidateSessionAuth } from "@workspace/client/lib/auth/invalidate-session-auth";
import { createDataTableLabels } from "@/lib/data-table-labels";
import { readPaginatedTotal, stubPaginatedMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { MerchantOrgResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Input } from "@workspace/ui/components/form/input";
import type { ColumnDef } from "@tanstack/react-table";
import { keepPreviousData } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface MerchantsAllTableProps {
	readonly initialMerchants?: readonly MerchantOrgResponse[];
	readonly initialTotal?: number;
}

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = React.useState(value);
	React.useEffect((): (() => void) => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);
		return (): void => {
			clearTimeout(handler);
		};
	}, [value, delay]);
	return debouncedValue;
}

export default function MerchantsAllTable({ initialMerchants, initialTotal }: MerchantsAllTableProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const [page, setPage] = React.useState(1);
	const [pageLimit, setPageLimit] = React.useState(20);
	const [search, setSearch] = React.useState("");
	const debouncedSearch = useDebounce(search, 300);

	const prevSearchRef = React.useRef(debouncedSearch);
	React.useEffect((): void => {
		if (debouncedSearch !== prevSearchRef.current) {
			setPage(1);
		}
		prevSearchRef.current = debouncedSearch;
	}, [debouncedSearch]);

	const initialQueryData = React.useMemo(
		() =>
			initialMerchants !== undefined
				? {
						success: true as const,
						data: [...initialMerchants],
						meta: stubPaginatedMeta(initialTotal ?? initialMerchants.length, 1, 20),
					}
				: undefined,
		[initialMerchants, initialTotal],
	);

	const trimmedSearch = debouncedSearch.trim();
	const merchantsQuery = api.rewardsAdmin.listMerchants.useQuery(
		{
			page,
			limit: pageLimit,
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
		},
		{
			placeholderData: keepPreviousData,
			initialData: page === 1 && pageLimit === 20 && trimmedSearch.length === 0 ? initialQueryData : undefined,
		},
	);

	const rows: readonly MerchantOrgResponse[] = merchantsQuery.data?.data ?? [];
	const total: number = readPaginatedTotal(merchantsQuery.data?.meta, initialTotal ?? rows.length);
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

	const handleManualPaginationChange = React.useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageLimit(nextPageSize);
	}, []);

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearch(event.target.value);
	}, []);

	const toolbarContent = React.useMemo(
		() => (
			<div className="relative w-full sm:max-w-xs">
				<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
				<Input aria-label={tableLabels.searchAriaLabel} placeholder={tableLabels.searchPlaceholder} value={search} onChange={handleSearchChange} className="h-9 pl-8" />
			</div>
		),
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
					<CardTitle className="text-base">{total.toLocaleString()} merchants</CardTitle>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={columns}
						data={[...rows]}
						labels={tableLabels}
						actions={actions}
						manual
						totalCount={total}
						pageIndex={page - 1}
						pageSize={pageLimit}
						pageSizeOptions={PAGE_SIZE_OPTIONS}
						error={tableError}
						isLoading={merchantsQuery.isLoading}
						isRefetching={merchantsQuery.isFetching && !merchantsQuery.isLoading}
						onManualPaginationChange={handleManualPaginationChange}
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
