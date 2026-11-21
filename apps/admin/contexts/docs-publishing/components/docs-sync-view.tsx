"use client";

import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { initialDataOption, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { ALL_FILTER_OPTION, parseFilterOption } from "@workspace/client/lib/api/list-query";
import { useAbility } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { docsSyncRunListQuery, DocsSyncRunStatusSchema, DocsSyncTriggerSchema, type DocsSyncOverview, type DocsSyncRunSummary, type Envelope } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataTable, type DataTableEmptyState, type DataTableFeatures, type DataTableFilter, type DataTablePaging } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";
import { RefreshCw } from "lucide-react";
import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";
import * as React from "react";

import { DOCS_SYNC_LOADING_LABELS } from "@/components/loading/loading-labels";
import { DOCS_SYNC_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";
import {
	DOCS_SYNC_RUNS_PAGE_SIZE_OPTIONS,
	DOCS_SYNC_RUNS_URL_STATE,
	isDocsSyncRunsFiltered,
	toDocsSyncRunListQuery,
} from "@/contexts/docs-publishing/url-state/docs-sync-runs";
import { toastMutationError } from "@/lib/api/mutation-error";
import { buildReadOnlyTableBulk, TABLE_COLUMN_CONTROLS, toTableStatus } from "@/lib/data-table/capabilities";
import { enumFilterOptions } from "@/lib/data-table/enum-filter-options";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { ROUTES } from "@/lib/routes";

import { DOCS_SYNC_STATUS_LABELS, DOCS_SYNC_TRIGGER_LABELS, DocsSyncStatusBadge } from "./docs-sync-badges";
import { DocsSyncSetup } from "./docs-sync-setup";

const FILTER_KEY = { status: "status", trigger: "trigger" } satisfies Record<string, string>;

const RUNS_BULK = buildReadOnlyTableBulk<DocsSyncRunSummary>("docs-sync-runs.csv", ["startedAt", "trigger", "status", "pagesProcessed", "pagesRemoved", "pagesHeldBack"]);
const RUNS_PAGING: DataTablePaging = { pageSizeOptions: DOCS_SYNC_RUNS_PAGE_SIZE_OPTIONS };
const RUNS_EMPTY: DataTableEmptyState = { title: "No sync runs", description: "No run matches this filter. Runs appear here once the sync can report to this server." };

function getRunRowId(run: DocsSyncRunSummary): string {
	return run.id;
}

/** Written, removed and held back; "No changes" when a run found nothing to do. */
function changeLabel(run: DocsSyncRunSummary): string {
	const parts = [
		run.pagesProcessed > 0 ? `${String(run.pagesProcessed)} written` : null,
		run.pagesRemoved > 0 ? `${String(run.pagesRemoved)} removed` : null,
		run.pagesHeldBack > 0 ? `${String(run.pagesHeldBack)} held back` : null,
	].filter((part) => part !== null);
	return parts.length === 0 ? "No changes" : parts.join(" · ");
}

/** The latest run and the latest clean one: the gap between them is what needs attention. */
function LatestRuns({ overview }: { readonly overview: DocsSyncOverview }): React.JSX.Element {
	const { latestRun, latestGoodRun } = overview;
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Latest</CardTitle>
				<CardDescription>What the sync did last, and when everything last published.</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="divide-y">
					<div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
						<dt className="text-sm font-medium">Last sync</dt>
						<dd className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
							{latestRun === null ? (
								"No sync has reported yet"
							) : (
								<>
									{formatDateTimeWithSeconds(latestRun.startedAt)}
									<DocsSyncStatusBadge status={latestRun.status} />
								</>
							)}
						</dd>
					</div>
					<div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
						<dt className="text-sm font-medium">Last clean sync</dt>
						<dd className="text-sm text-muted-foreground tabular-nums">{latestGoodRun === null ? "None yet" : formatDateTimeWithSeconds(latestGoodRun.startedAt)}</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}

export interface DocsSyncViewProps {
	readonly initialOverview?: Envelope<DocsSyncOverview> | undefined;
	readonly initialPage?: PrefetchedQuery<Envelope<DocsSyncRunSummary[]>> | undefined;
}

/**
 * Docs sync (ADR 084): how publishing from the writing tool is going. The page owns the data and the columns; the
 * shared `DataTable` renders them. Filters, sort and page live in the URL. A row opens the run's own page, which
 * lists each held-back page and what to change.
 */
export default function DocsSyncView({ initialOverview, initialPage }: DocsSyncViewProps): React.JSX.Element {
	const { api } = useAuth();
	const ability = useAbility();
	const router = useProgressRouter();
	const queryClient = useQueryClient();
	const [urlState, updateUrlState] = useUrlState(DOCS_SYNC_RUNS_URL_STATE);
	const isFiltered = isDocsSyncRunsFiltered(urlState);

	const overviewQuery = api.docsPublishing.overview.useQuery({}, initialDataOption(initialOverview));
	const stateKey: string = DOCS_SYNC_RUNS_URL_STATE.serialize(urlState);
	const listQuery = api.docsPublishing.runs.useQuery(toDocsSyncRunListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});

	const startSync = api.docsPublishing.startSync.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Sync started", description: "It reports here when it finishes, usually within a few minutes." });
			await queryClient.invalidateQueries({ queryKey: apiRouter.docsPublishing.overview.queryKey({}) });
		},
		onError: (error): void => {
			toastMutationError("Could not start the sync", error);
		},
	});
	const { mutate: mutateStart } = startSync;
	const handleStart = React.useCallback((): void => {
		mutateStart({ full: false });
	}, [mutateStart]);
	const handleRebuild = React.useCallback((): void => {
		mutateStart({ full: true });
	}, [mutateStart]);

	const rows = React.useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
	const totalCount = readPaginatedTotal(listQuery.data?.meta, rows.length);
	const isRefetching: boolean = listQuery.isFetching && !listQuery.isLoading;

	const handleClearFilters = React.useCallback((): void => {
		updateUrlState({ status: undefined, trigger: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	const handleManualColumnFilterChange = React.useCallback(
		(filterKey: string, value: string | null): void => {
			const option: string = value ?? "";
			if (filterKey === FILTER_KEY.status) {
				updateUrlState({ status: parseFilterOption(option, DocsSyncRunStatusSchema), page: LIST_FIRST_PAGE, cursor: undefined });
			} else if (filterKey === FILTER_KEY.trigger) {
				updateUrlState({ trigger: parseFilterOption(option, DocsSyncTriggerSchema), page: LIST_FIRST_PAGE, cursor: undefined });
			}
		},
		[updateUrlState],
	);

	const manualColumnFilters = React.useMemo(
		(): Readonly<Record<string, string>> => ({
			[FILTER_KEY.status]: urlState.status ?? ALL_FILTER_OPTION,
			[FILTER_KEY.trigger]: urlState.trigger ?? ALL_FILTER_OPTION,
		}),
		[urlState.status, urlState.trigger],
	);
	const { source, getRowId } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: docsSyncRunListQuery,
		totalCount,
		nextCursor: readPaginatedNextCursor(listQuery.data?.meta),
		getRowId: getRunRowId,
		filters: manualColumnFilters,
		onFilterChange: handleManualColumnFilterChange,
		isFiltered,
		onClearFilters: handleClearFilters,
	});

	const filters = React.useMemo(
		(): DataTableFilter[] => [
			{ kind: "select", column: FILTER_KEY.status, label: "Status", options: enumFilterOptions(DocsSyncRunStatusSchema.options, DOCS_SYNC_STATUS_LABELS) },
			{ kind: "select", column: FILTER_KEY.trigger, label: "Started by", options: enumFilterOptions(DocsSyncTriggerSchema.options, DOCS_SYNC_TRIGGER_LABELS) },
		],
		[],
	);

	const columns = React.useMemo<ColumnDef<DataTableFeatures, DocsSyncRunSummary>[]>(
		() => [
			{
				accessorKey: "startedAt",
				header: "Started",
				enableHiding: false,
				enableSorting: true,
				cell: ({ row }): React.JSX.Element => (
					<span className="whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTimeWithSeconds(row.original.startedAt)}</span>
				),
			},
			{
				accessorKey: "trigger",
				header: "Started by",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <span className="font-medium">{DOCS_SYNC_TRIGGER_LABELS[row.original.trigger]}</span>,
			},
			{
				accessorKey: "status",
				header: "Status",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <DocsSyncStatusBadge status={row.original.status} />,
			},
			{
				accessorKey: "pagesProcessed",
				header: "Changes",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <span className="whitespace-nowrap text-muted-foreground tabular-nums">{changeLabel(row.original)}</span>,
			},
			{
				accessorKey: "pagesUnchanged",
				header: "Unchanged",
				enableSorting: false,
				cell: ({ row }): React.JSX.Element => <span className="text-muted-foreground tabular-nums">{row.original.pagesUnchanged}</span>,
			},
		],
		[],
	);

	const mobileCardRender = React.useCallback(
		(item: DocsSyncRunSummary): React.ReactNode => (
			<DataTableMobileCard
				item={item}
				title={DOCS_SYNC_TRIGGER_LABELS[item.trigger]}
				subtitle={formatDateTimeWithSeconds(item.startedAt)}
				badge={<DocsSyncStatusBadge status={item.status} />}
				fields={[{ label: "Changes", value: changeLabel(item) }]}
			/>
		),
		[],
	);

	const handleRowClick = React.useCallback(
		(run: DocsSyncRunSummary): void => {
			router.push(ROUTES.operations.docsSyncRun(run.id));
		},
		[router],
	);

	const overview = overviewQuery.data?.data;
	if ((listQuery.isLoading && rows.length === 0) || overview === undefined) {
		if (overviewQuery.error !== null || listQuery.error !== null) {
			return (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
					Failed to load the docs sync — check that the API is running and you&apos;re signed in.
				</div>
			);
		}
		return <TablePageSkeleton labels={DOCS_SYNC_LOADING_LABELS} shape={DOCS_SYNC_TABLE_PAGE} />;
	}

	const canStart: boolean = ability.can("CREATE", "DOCS_SYNC") && overview.dispatchConfigured;

	return (
		<div className="mx-auto w-full max-w-10xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Docs sync</h1>
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						Pages published in the writing tool become reviewed pull requests, then the live docs site. A page that cannot publish is held back here with what to change, and
						the site keeps its last good version.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" disabled={!canStart || startSync.isPending} onClick={handleRebuild}>
						Rebuild all pages
					</Button>
					<Button size="sm" className="gap-1.5" disabled={!canStart || startSync.isPending} onClick={handleStart}>
						<RefreshCw className="size-3.5" aria-hidden />
						Sync now
					</Button>
				</div>
			</header>

			<div className="grid gap-6 lg:grid-cols-2">
				<DocsSyncSetup overview={overview} />
				<LatestRuns overview={overview} />
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Runs</CardTitle>
					<CardDescription>{totalCount} kept · newest first</CardDescription>
				</CardHeader>
				<CardContent>
					<DataTable
						data={rows}
						columns={columns}
						getRowId={getRowId}
						source={source}
						filters={filters}
						selection={RUNS_BULK.selection}
						exporting={RUNS_BULK.exporting}
						columnControls={TABLE_COLUMN_CONTROLS}
						paging={RUNS_PAGING}
						status={toTableStatus({ isLoading: false, isFetching: isRefetching })}
						mobileCard={mobileCardRender}
						onRowClick={handleRowClick}
						emptyState={RUNS_EMPTY}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
