"use client";

import { initialDataOption, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { ALL_FILTER_OPTION, parseFilterOption, toListSearch } from "@workspace/client/lib/api/list-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import {
	receivedWebhookListQuery,
	ReceivedWebhookOutcomeSchema,
	ReceivedWebhookProviderSchema,
	ReceivedWebhookVerificationSchema,
	type Envelope,
	type ReceivedWebhookOutcome,
	type ReceivedWebhookProvider,
	type ReceivedWebhookSummary,
	type ReceivedWebhookVerification,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataTable, type DataTableFeatures, type Filter } from "@workspace/ui/components/data-table";
import { keepPreviousData } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { RECEIVED_WEBHOOKS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { RECEIVED_WEBHOOKS_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table/capabilities";
import {
	enumFilterOptions,
	RECEIVED_WEBHOOK_OUTCOME_LABELS,
	RECEIVED_WEBHOOK_PROVIDER_LABELS,
	RECEIVED_WEBHOOK_VERIFICATION_LABELS,
} from "@/lib/data-table/enum-filter-options";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { useTableTextDraft } from "@/lib/data-table/use-table-text-draft";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { ROUTES } from "@/lib/routes";
import {
	isReceivedWebhooksFiltered,
	RECEIVED_WEBHOOKS_PAGE_SIZE_OPTIONS,
	RECEIVED_WEBHOOKS_URL_STATE,
	toReceivedWebhookListQuery,
} from "@/contexts/webhooks/url-state/received-webhooks";

import { ReceivedWebhookOutcomeBadge, ReceivedWebhookVerificationBadge } from "./received-webhook-badges";

/** What a missing value renders as. */
const NOT_RECORDED = "—";

/** The filter keys of the table, as `DataTable` names them. */
const FILTER_KEY = { provider: "provider", outcome: "outcome", verification: "verification" } satisfies Record<string, string>;

function getReceivedWebhookRowId(entry: ReceivedWebhookSummary): string {
	return entry.id;
}

/** Attempts handed to the owner, plus the redeliveries answered without processing. */
function attemptsLabel(entry: ReceivedWebhookSummary): string {
	return entry.duplicateCount === 0 ? String(entry.attempts) : `${String(entry.attempts)} · ${String(entry.duplicateCount)} duplicate`;
}

/** The delivery id in a monospace, truncated cell (the full id on hover). */
function DeliveryIdCell({ deliveryId }: { readonly deliveryId: string | null }): React.JSX.Element {
	if (deliveryId === null) {
		return <span className="text-muted-foreground">{NOT_RECORDED}</span>;
	}
	return (
		<span title={deliveryId} className="block max-w-56 truncate font-mono text-xs">
			{deliveryId}
		</span>
	);
}

/**
 * Received webhooks — every request a provider (GitHub, Resend, Billplz, CHIP,
 * Twilio) sent the API, verified or not (ADR 081). The page owns the data
 * (`GET /admin/webhooks/received`), the columns and the badges; the shared
 * `DataTable` renders it. Search, the provider / outcome / signature filters,
 * sort and page live in the URL. A row opens the webhook's own page.
 */
export default function ReceivedWebhooksView({ initialPage }: { readonly initialPage?: PrefetchedQuery<Envelope<ReceivedWebhookSummary[]>> | undefined }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const [urlState, updateUrlState] = useUrlState(RECEIVED_WEBHOOKS_URL_STATE);
	const isFiltered = isReceivedWebhooksFiltered(urlState);

	const commitSearch = React.useCallback(
		(value: string): void => {
			updateUrlState({ search: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const [searchDraft, setSearchDraft] = useTableTextDraft(urlState.search, commitSearch);

	const handleClearFilters = React.useCallback((): void => {
		updateUrlState({ search: undefined, provider: undefined, outcome: undefined, verification: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	const stateKey: string = RECEIVED_WEBHOOKS_URL_STATE.serialize(urlState);
	const listQuery = api.receivedWebhooks.list.useQuery(toReceivedWebhookListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});

	const rows = React.useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
	const totalCount = readPaginatedTotal(listQuery.data?.meta, rows.length);
	const isRefetching: boolean = listQuery.isFetching && !listQuery.isLoading;
	const { pagination, sorting, handleSortingChange } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: receivedWebhookListQuery,
		totalCount,
		nextCursor: readPaginatedNextCursor(listQuery.data?.meta),
		resetKey: RECEIVED_WEBHOOKS_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined }),
		getRowId: getReceivedWebhookRowId,
		onClearFilters: handleClearFilters,
		isFiltered,
	});

	const handleManualColumnFilterChange = React.useCallback(
		(filterKey: string, value: string | null): void => {
			const option: string = value ?? "";
			if (filterKey === FILTER_KEY.provider) {
				const provider: ReceivedWebhookProvider | undefined = parseFilterOption(option, ReceivedWebhookProviderSchema);
				updateUrlState({ provider, page: LIST_FIRST_PAGE, cursor: undefined });
			} else if (filterKey === FILTER_KEY.outcome) {
				const outcome: ReceivedWebhookOutcome | undefined = parseFilterOption(option, ReceivedWebhookOutcomeSchema);
				updateUrlState({ outcome, page: LIST_FIRST_PAGE, cursor: undefined });
			} else if (filterKey === FILTER_KEY.verification) {
				const verification: ReceivedWebhookVerification | undefined = parseFilterOption(option, ReceivedWebhookVerificationSchema);
				updateUrlState({ verification, page: LIST_FIRST_PAGE, cursor: undefined });
			}
		},
		[updateUrlState],
	);

	const manualColumnFilters = React.useMemo(
		(): Readonly<Record<string, string>> => ({
			[FILTER_KEY.provider]: urlState.provider ?? ALL_FILTER_OPTION,
			[FILTER_KEY.outcome]: urlState.outcome ?? ALL_FILTER_OPTION,
			[FILTER_KEY.verification]: urlState.verification ?? ALL_FILTER_OPTION,
		}),
		[urlState.provider, urlState.outcome, urlState.verification],
	);

	const searchToolbar = React.useMemo(
		(): React.JSX.Element => (
			<DataTableSearchToolbar value={searchDraft} onChange={setSearchDraft} placeholder="Search delivery id, event, correlation id..." ariaLabel="Search received webhooks" />
		),
		[searchDraft, setSearchDraft],
	);

	const filters = React.useMemo(
		(): Filter[] => [
			{ key: FILTER_KEY.provider, label: "Provider", options: enumFilterOptions(ReceivedWebhookProviderSchema.options, RECEIVED_WEBHOOK_PROVIDER_LABELS) },
			{ key: FILTER_KEY.outcome, label: "Outcome", options: enumFilterOptions(ReceivedWebhookOutcomeSchema.options, RECEIVED_WEBHOOK_OUTCOME_LABELS) },
			{ key: FILTER_KEY.verification, label: "Signature", options: enumFilterOptions(ReceivedWebhookVerificationSchema.options, RECEIVED_WEBHOOK_VERIFICATION_LABELS) },
		],
		[],
	);

	const checkbox = React.useMemo(
		() => buildReadOnlyTableCheckbox("received-webhooks.csv", ["receivedAt", "provider", "eventType", "providerDeliveryId", "verification", "outcome", "httpStatus"]),
		[],
	);

	const columns = React.useMemo<ColumnDef<DataTableFeatures, ReceivedWebhookSummary>[]>(
		() => [
			{
				accessorKey: "receivedAt",
				header: "Received",
				enableHiding: false,
				enableSorting: true,
				cell: ({ row }): React.JSX.Element => (
					<span className="whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTimeWithSeconds(row.original.receivedAt)}</span>
				),
			},
			{
				accessorKey: "provider",
				header: "Provider",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <span className="font-medium">{RECEIVED_WEBHOOK_PROVIDER_LABELS[row.original.provider]}</span>,
			},
			{
				accessorKey: "eventType",
				header: "Event",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <span className="font-mono text-xs">{row.original.eventType ?? NOT_RECORDED}</span>,
			},
			{
				accessorKey: "providerDeliveryId",
				header: "Delivery id",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <DeliveryIdCell deliveryId={row.original.providerDeliveryId} />,
			},
			{
				accessorKey: "verification",
				header: "Signature",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <ReceivedWebhookVerificationBadge verification={row.original.verification} />,
			},
			{
				accessorKey: "outcome",
				header: "Outcome",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <ReceivedWebhookOutcomeBadge outcome={row.original.outcome} />,
			},
			{
				accessorKey: "httpStatus",
				header: "HTTP",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => (
					<span className="font-mono text-xs tabular-nums">{row.original.httpStatus === null ? NOT_RECORDED : String(row.original.httpStatus)}</span>
				),
			},
			{
				accessorKey: "attempts",
				header: "Attempts",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <span className="whitespace-nowrap text-muted-foreground tabular-nums">{attemptsLabel(row.original)}</span>,
			},
		],
		[],
	);

	const mobileCardRender = React.useCallback(
		(item: ReceivedWebhookSummary): React.ReactNode => (
			<DataTableMobileCard
				item={item}
				title={RECEIVED_WEBHOOK_PROVIDER_LABELS[item.provider]}
				subtitle={item.eventType ?? NOT_RECORDED}
				badge={<ReceivedWebhookOutcomeBadge outcome={item.outcome} />}
				fields={[
					{ label: "Received", value: formatDateTimeWithSeconds(item.receivedAt) },
					{ label: "Signature", value: RECEIVED_WEBHOOK_VERIFICATION_LABELS[item.verification] },
					{ label: "Delivery id", value: item.providerDeliveryId ?? NOT_RECORDED },
					{ label: "HTTP", value: item.httpStatus === null ? NOT_RECORDED : String(item.httpStatus) },
				]}
			/>
		),
		[],
	);

	const handleRowClick = React.useCallback(
		(entry: ReceivedWebhookSummary): void => {
			router.push(ROUTES.webhooks.receivedDetail(entry.id));
		},
		[router],
	);

	const handleRefresh = React.useCallback((): void => {
		void listQuery.refetch();
	}, [listQuery]);

	if (listQuery.isLoading && rows.length === 0) {
		return <TablePageSkeleton labels={RECEIVED_WEBHOOKS_LOADING_LABELS} shape={RECEIVED_WEBHOOKS_TABLE_PAGE} />;
	}

	if (listQuery.error !== null && rows.length === 0) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
				Failed to load the received webhooks — check that the API is running and you&apos;re signed in.
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-10xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Received webhooks</h1>
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						Every request GitHub, Resend, the payment gateways and Twilio sent the API — whether its signature checked out, and what it came to. A redelivery is answered
						without being processed twice. Bodies are never kept: only their fingerprint and the non-secret headers.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
					<RefreshCw className="size-3.5" />
					Refresh
				</Button>
			</header>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Deliveries</CardTitle>
					<CardDescription>{totalCount} received · newest first</CardDescription>
				</CardHeader>
				<CardContent>
					<DataTable
						data={rows}
						columns={columns}
						searchKeys={[]}
						toolbarContent={searchToolbar}
						filters={filters}
						manualColumnFilters={manualColumnFilters}
						onManualColumnFilterChange={handleManualColumnFilterChange}
						checkbox={checkbox}
						enableColumnVisibility
						pagination={pagination}
						pageSizeOptions={RECEIVED_WEBHOOKS_PAGE_SIZE_OPTIONS}
						sorting={sorting}
						onManualSortingChange={handleSortingChange}
						isRefetching={isRefetching}
						mobileCardRender={mobileCardRender}
						onRowClick={handleRowClick}
						emptyState={{
							title: "No webhooks received",
							description: "No delivery matches this filter yet. Providers' requests appear here the moment they arrive.",
						}}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
