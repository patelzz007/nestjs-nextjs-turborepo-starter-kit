"use client";

import { initialDataOption, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { ALL_FILTER_OPTION, parseFilterOption, toListSearch } from "@workspace/client/lib/api/list-query";
import { useAuth } from "@workspace/client/lib/auth";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import {
	AuditAuthMethodSchema,
	AuditHttpMethodSchema,
	AuditOutcomeSchema,
	DeviceTypeSchema,
	httpAuditLogListQuery,
	IpAddressScopeSchema,
	type Envelope,
	type HttpAuditLogSummary,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import { keepPreviousData } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, RefreshCw, X } from "lucide-react";
import * as React from "react";

import {
	AuditActorCell,
	AuditAuthMethodBadge,
	AuditDeviceBadge,
	AuditIpScopeBadge,
	AuditMethodBadge,
	AuditOutcomeBadge,
	describeClientSoftware,
} from "@/components/audit-logs/audit-log-badges";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import {
	AUDIT_AUTH_METHOD_LABELS,
	AUDIT_HTTP_METHOD_LABELS,
	AUDIT_OUTCOME_LABELS,
	DEVICE_TYPE_LABELS,
	enumFilterOptions,
	IP_ADDRESS_SCOPE_LABELS,
} from "@/lib/data-table/enum-filter-options";
import { ADMIN_DATA_TABLE_LABELS } from "@/lib/data-table/labels";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { useTableTextDraft } from "@/lib/data-table/use-table-text-draft";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { countryFlag, countryName } from "@/lib/format/country";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { AUDIT_LOG_PAGE_SIZE_OPTIONS, AUDIT_LOG_URL_STATE, isAuditLogFiltered, toAuditLogListQuery, type AuditLogUrlState } from "@/lib/url-state/audit-logs";
import { AUDIT_LOG_RECORD_URL_STATE } from "@/lib/url-state/selection";

import { AuditLogDrawer } from "./audit-log-drawer";

/** The select filters the toolbar offers (the id filters arrive from the record's links). */
const SELECT_FILTERS: Filter[] = [
	{ key: "outcome", label: "Outcome", options: enumFilterOptions(AuditOutcomeSchema.options, AUDIT_OUTCOME_LABELS) },
	{ key: "method", label: "Method", options: enumFilterOptions(AuditHttpMethodSchema.options, AUDIT_HTTP_METHOD_LABELS) },
	{ key: "authMethod", label: "Credential", options: enumFilterOptions(AuditAuthMethodSchema.options, AUDIT_AUTH_METHOD_LABELS) },
	{ key: "deviceType", label: "Device", options: enumFilterOptions(DeviceTypeSchema.options, DEVICE_TYPE_LABELS) },
	{ key: "ipScope", label: "Address class", options: enumFilterOptions(IpAddressScopeSchema.options, IP_ADDRESS_SCOPE_LABELS) },
];

/** The URL state with every filter, the search and the paging reset. */
const CLEARED_FILTERS: Partial<AuditLogUrlState> = {
	search: undefined,
	outcome: undefined,
	method: undefined,
	authMethod: undefined,
	deviceType: undefined,
	ipScope: undefined,
	actorUserId: undefined,
	organizationId: undefined,
	correlationId: undefined,
	page: LIST_FIRST_PAGE,
	cursor: undefined,
};

function getAuditLogRowId(entry: HttpAuditLogSummary): string {
	return entry.id;
}

/** One id filter set from a detail-page link, shown as a removable chip. */
function IdFilterChip({ label, value, onClear }: { readonly label: string; readonly value: string; readonly onClear: () => void }): React.JSX.Element {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-input bg-muted px-2.5 py-1 text-xs">
			<span className="text-muted-foreground">{label}</span>
			<code className="max-w-40 truncate font-mono">{value}</code>
			<button type="button" onClick={onClear} aria-label={`Remove the ${label} filter`} className="rounded-full p-0.5 hover:bg-background">
				<X className="size-3" />
			</button>
		</span>
	);
}

/**
 * Audit log — the admin viewer of the global HTTP audit trail.
 *
 * The page owns the data (`GET /admin/audit-logs`), the columns and the
 * presentation; search, filters, sort and page live in the URL
 * (lib/url-state/audit-logs), so a filtered view can be shared. Clicking a row
 * opens its complete record in a drawer (`?record=`). Viewing this page is
 * itself audited by the API.
 */
export default function AuditLogView({ initialPage }: { readonly initialPage?: PrefetchedQuery<Envelope<HttpAuditLogSummary[]>> | undefined }): React.JSX.Element {
	const { api } = useAuth();
	const [urlState, updateUrlState] = useUrlState(AUDIT_LOG_URL_STATE);
	// The record open in the drawer — its own URL param, so opening one never resets the table's paging.
	const [selection, updateSelection] = useUrlState(AUDIT_LOG_RECORD_URL_STATE);
	const handleRowClick = React.useCallback(
		(entry: HttpAuditLogSummary): void => {
			updateSelection({ record: entry.id });
		},
		[updateSelection],
	);
	const handleDrawerClose = React.useCallback((): void => {
		updateSelection({ record: undefined });
	}, [updateSelection]);
	const isFiltered: boolean = isAuditLogFiltered(urlState);

	const commitSearch = React.useCallback(
		(value: string): void => {
			updateUrlState({ search: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const [searchDraft, setSearchDraft] = useTableTextDraft(urlState.search, commitSearch);

	const handleClearFilters = React.useCallback((): void => {
		updateUrlState(CLEARED_FILTERS);
	}, [updateUrlState]);

	const stateKey: string = AUDIT_LOG_URL_STATE.serialize(urlState);
	const logQuery = api.auditLogs.list.useQuery(toAuditLogListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});

	// Stable rows reference (rule 16 — avoid re-renders via new array identity).
	const rows = React.useMemo(() => logQuery.data?.data ?? [], [logQuery.data]);
	const totalCount: number = readPaginatedTotal(logQuery.data?.meta, rows.length);
	const isRefetching: boolean = logQuery.isFetching && !logQuery.isLoading;
	const { pagination, sorting, handleSortingChange } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: httpAuditLogListQuery,
		totalCount,
		nextCursor: readPaginatedNextCursor(logQuery.data?.meta),
		resetKey: AUDIT_LOG_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined }),
		getRowId: getAuditLogRowId,
		onClearFilters: handleClearFilters,
		isFiltered,
	});

	const handleManualColumnFilterChange = React.useCallback(
		(filterKey: string, value: string | null): void => {
			const option: string = value ?? "";
			const reset = { page: LIST_FIRST_PAGE, cursor: undefined };
			if (filterKey === "outcome") {
				updateUrlState({ outcome: parseFilterOption(option, AuditOutcomeSchema), ...reset });
			} else if (filterKey === "method") {
				updateUrlState({ method: parseFilterOption(option, AuditHttpMethodSchema), ...reset });
			} else if (filterKey === "authMethod") {
				updateUrlState({ authMethod: parseFilterOption(option, AuditAuthMethodSchema), ...reset });
			} else if (filterKey === "deviceType") {
				updateUrlState({ deviceType: parseFilterOption(option, DeviceTypeSchema), ...reset });
			} else if (filterKey === "ipScope") {
				updateUrlState({ ipScope: parseFilterOption(option, IpAddressScopeSchema), ...reset });
			}
		},
		[updateUrlState],
	);

	const manualColumnFilters = React.useMemo(
		(): Readonly<Record<string, string>> => ({
			outcome: urlState.outcome ?? ALL_FILTER_OPTION,
			method: urlState.method ?? ALL_FILTER_OPTION,
			authMethod: urlState.authMethod ?? ALL_FILTER_OPTION,
			deviceType: urlState.deviceType ?? ALL_FILTER_OPTION,
			ipScope: urlState.ipScope ?? ALL_FILTER_OPTION,
		}),
		[urlState.outcome, urlState.method, urlState.authMethod, urlState.deviceType, urlState.ipScope],
	);

	const clearActor = React.useCallback((): void => {
		updateUrlState({ actorUserId: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);
	const clearOrganization = React.useCallback((): void => {
		updateUrlState({ organizationId: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);
	const clearCorrelation = React.useCallback((): void => {
		updateUrlState({ correlationId: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	const searchToolbar = React.useMemo(
		(): React.JSX.Element => (
			<DataTableSearchToolbar
				value={searchDraft}
				onChange={setSearchDraft}
				placeholder="Search path, endpoint, error code, IP, correlation id..."
				ariaLabel="Search audit log"
			/>
		),
		[searchDraft, setSearchDraft],
	);

	const columns = React.useMemo<ColumnDef<DataTableFeatures, HttpAuditLogSummary>[]>(
		() => [
			{
				accessorKey: "occurredAt",
				header: "Time",
				enableSorting: true,
				enableHiding: false,
				cell: ({ row }): React.JSX.Element => (
					<div className="whitespace-nowrap tabular-nums">
						<p>{formatDateTimeWithSeconds(row.original.occurredAt)}</p>
						<p className="text-xs text-muted-foreground">{row.original.durationMs} ms</p>
					</div>
				),
			},
			{
				accessorKey: "endpoint",
				header: "Request",
				enableSorting: true,
				enableHiding: false,
				cell: ({ row }): React.JSX.Element => (
					<div className="max-w-md min-w-0">
						<div className="flex items-center gap-2">
							<AuditMethodBadge method={row.original.method} />
							<span className="truncate font-mono text-xs font-medium" title={row.original.endpoint}>
								{row.original.endpoint}
							</span>
						</div>
						<p className="mt-0.5 truncate font-mono text-xs text-muted-foreground" title={row.original.path}>
							{row.original.path}
						</p>
					</div>
				),
			},
			{
				accessorKey: "responseStatus",
				header: "Outcome",
				enableSorting: true,
				cell: ({ row }): React.JSX.Element => (
					<div className="flex flex-col items-start gap-1">
						<AuditOutcomeBadge outcome={row.original.outcome} status={row.original.responseStatus} />
						{row.original.errorCode === null ? null : <code className="text-xs text-destructive">{row.original.errorCode}</code>}
					</div>
				),
			},
			{
				id: "actor",
				header: "Actor",
				cell: ({ row }): React.JSX.Element => <AuditActorCell entry={row.original} />,
			},
			{
				id: "organization",
				header: "Organization",
				cell: ({ row }): React.JSX.Element => (
					<span className="text-muted-foreground">{row.original.organization === null ? "—" : (row.original.organization.name ?? row.original.organization.id)}</span>
				),
			},
			{
				id: "device",
				header: "Device",
				cell: ({ row }): React.JSX.Element => (
					<div className="flex max-w-48 min-w-0 flex-col items-start gap-1 text-xs">
						{row.original.deviceType === null ? <span className="text-muted-foreground">—</span> : <AuditDeviceBadge deviceType={row.original.deviceType} />}
						<span className="truncate text-muted-foreground" title={row.original.userAgent ?? undefined}>
							{describeClientSoftware(row.original) ?? "—"}
						</span>
					</div>
				),
			},
			{
				id: "client",
				header: "Client",
				cell: ({ row }): React.JSX.Element => (
					<div className="flex flex-col items-start gap-1 text-xs">
						<span className="font-mono">{row.original.ipAddress ?? "—"}</span>
						<div className="flex flex-wrap gap-1">
							{row.original.ipScope === null ? null : <AuditIpScopeBadge scope={row.original.ipScope} />}
							<AuditAuthMethodBadge authMethod={row.original.authMethod} />
						</div>
						{row.original.geoCountry === null ? null : (
							<span className="text-muted-foreground" title={countryName(row.original.geoCountry)}>
								{countryFlag(row.original.geoCountry) ?? row.original.geoCountry} {row.original.geoCity ?? countryName(row.original.geoCountry)}
							</span>
						)}
					</div>
				),
			},
		],
		[],
	);

	const mobileCardRender = React.useCallback(
		(item: HttpAuditLogSummary): React.ReactNode => (
			<DataTableMobileCard
				item={item}
				title={`${item.method} ${item.endpoint}`}
				subtitle={formatDateTimeWithSeconds(item.occurredAt)}
				badge={<AuditOutcomeBadge outcome={item.outcome} status={item.responseStatus} />}
				fields={[
					{ label: "Actor", value: item.actor?.email ?? item.actor?.id ?? (item.apiKeyId === null ? "Anonymous" : "API key") },
					{ label: "IP", value: item.ipAddress ?? "—" },
					{ label: "Duration", value: `${String(item.durationMs)} ms` },
					...(item.errorCode === null ? [] : [{ label: "Error", value: item.errorCode }]),
				]}
			/>
		),
		[],
	);

	const handleRefresh = React.useCallback((): void => {
		void logQuery.refetch();
	}, [logQuery]);

	if (logQuery.isLoading && rows.length === 0) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Loading audit log…</p>
				</div>
			</div>
		);
	}

	if (logQuery.error !== null && rows.length === 0) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
				Failed to load the audit log — check that the API is running and that your role grants audit-log access.
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit log</h1>
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						Every request to the API — reads included, successful or refused — with who did it, from which device and where, with which credential, what was sent and what came
						back. Secrets are redacted and personal data masked before anything is stored. Records can never be edited or deleted, and opening this page is itself recorded.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
					<RefreshCw className="size-3.5" />
					Refresh
				</Button>
			</header>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Records</CardTitle>
					<CardDescription>{totalCount} records · newest first unless you sort a column · click a row for its details</CardDescription>
					{urlState.actorUserId === undefined && urlState.organizationId === undefined && urlState.correlationId === undefined ? null : (
						<div className="flex flex-wrap gap-2 pt-2">
							{urlState.actorUserId === undefined ? null : <IdFilterChip label="Actor" value={urlState.actorUserId} onClear={clearActor} />}
							{urlState.organizationId === undefined ? null : <IdFilterChip label="Organization" value={urlState.organizationId} onClear={clearOrganization} />}
							{urlState.correlationId === undefined ? null : <IdFilterChip label="Correlation" value={urlState.correlationId} onClear={clearCorrelation} />}
						</div>
					)}
				</CardHeader>
				<CardContent>
					<DataTable
						labels={ADMIN_DATA_TABLE_LABELS}
						data={rows}
						columns={columns}
						searchKeys={[]}
						toolbarContent={searchToolbar}
						filters={SELECT_FILTERS}
						manualColumnFilters={manualColumnFilters}
						onManualColumnFilterChange={handleManualColumnFilterChange}
						enableColumnVisibility
						pagination={pagination}
						pageSizeOptions={AUDIT_LOG_PAGE_SIZE_OPTIONS}
						sorting={sorting}
						onManualSortingChange={handleSortingChange}
						isRefetching={isRefetching}
						mobileCardRender={mobileCardRender}
						onRowClick={handleRowClick}
					/>
				</CardContent>
			</Card>

			<AuditLogDrawer recordId={selection.record} onClose={handleDrawerClose} />
		</div>
	);
}
