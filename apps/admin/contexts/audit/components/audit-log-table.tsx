"use client";

import { initialDataOption, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { ALL_FILTER_OPTION, parseFilterOption, toListSearch } from "@workspace/client/lib/api/list-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import {
	AuditAuthMethodSchema,
	AuditHttpMethodSchema,
	AuditOutcomeSchema,
	auditTrailListQuery,
	AuditTrailEntryKindSchema,
	DataChangeActorKindSchema,
	DeviceTypeSchema,
	IpAddressScopeSchema,
	type AuditTrailBackgroundEntry,
	type AuditTrailEntry,
	type Envelope,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataTable, type DataTableFeatures, type Filter } from "@workspace/ui/components/data-table";
import { keepPreviousData } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Database, RefreshCw } from "lucide-react";
import * as React from "react";

import {
	AuditActorCell,
	AuditAuthMethodBadge,
	AuditDeviceBadge,
	AuditIpScopeBadge,
	AuditMethodBadge,
	AuditOutcomeBadge,
	describeClientSoftware,
} from "@/contexts/audit/components/audit-logs/audit-log-badges";
import { DataChangeActorCell, DataChangeOperationBadge } from "@/contexts/audit/components/audit-logs/data-change-badges";
import { DataChangeDrawer } from "@/contexts/audit/components/audit-logs/data-change-drawer";
import { IdFilterChip } from "@/contexts/audit/components/audit-logs/id-filter-chip";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { LivePill } from "@/components/common/live-pill";
import { AUDIT_LOG_LOADING_LABELS } from "@/components/loading/loading-labels";
import { AUDIT_LOG_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";
import {
	AUDIT_AUTH_METHOD_LABELS,
	AUDIT_HTTP_METHOD_LABELS,
	AUDIT_OUTCOME_LABELS,
	AUDIT_TRAIL_KIND_LABELS,
	DATA_CHANGE_ACTOR_KIND_LABELS,
	DEVICE_TYPE_LABELS,
	enumFilterOptions,
	IP_ADDRESS_SCOPE_LABELS,
} from "@/lib/data-table/enum-filter-options";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { useTableTextDraft } from "@/lib/data-table/use-table-text-draft";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { countryFlag, countryName } from "@/lib/format/country";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { useAuditTrailLive } from "@/contexts/notifications";
import {
	AUDIT_LOG_FILTER_KEYS,
	AUDIT_LOG_PAGE_SIZE_OPTIONS,
	AUDIT_LOG_URL_STATE,
	isAuditLogFiltered,
	toAuditLogListQuery,
	type AuditLogUrlState,
} from "@/contexts/audit/url-state/audit-logs";
import { AUDIT_LOG_RECORD_URL_STATE, DATA_CHANGE_RECORD_URL_STATE } from "@/lib/url-state/selection";

import { AuditLogDrawer } from "./audit-log-drawer";

/**
 * The select filters the toolbar offers (the id filters arrive from links).
 * The request-only ones (outcome … address class) leave only requests; "Attributed
 * to" leaves only background writes — the API applies the same rule.
 */
const SELECT_FILTERS: Filter[] = [
	{ key: "kind", label: "Source", options: enumFilterOptions(AuditTrailEntryKindSchema.options, AUDIT_TRAIL_KIND_LABELS) },
	{ key: "outcome", label: "Outcome", options: enumFilterOptions(AuditOutcomeSchema.options, AUDIT_OUTCOME_LABELS) },
	{ key: "method", label: "Method", options: enumFilterOptions(AuditHttpMethodSchema.options, AUDIT_HTTP_METHOD_LABELS) },
	{ key: "authMethod", label: "Credential", options: enumFilterOptions(AuditAuthMethodSchema.options, AUDIT_AUTH_METHOD_LABELS) },
	{ key: "deviceType", label: "Device", options: enumFilterOptions(DeviceTypeSchema.options, DEVICE_TYPE_LABELS) },
	{ key: "ipScope", label: "Address class", options: enumFilterOptions(IpAddressScopeSchema.options, IP_ADDRESS_SCOPE_LABELS) },
	{ key: "actorKind", label: "Attributed to", options: enumFilterOptions(DataChangeActorKindSchema.options, DATA_CHANGE_ACTOR_KIND_LABELS) },
];

/** The id filters — each shown as a removable chip while set. */
type IdFilterKey = "actorUserId" | "tenantId" | "correlationId" | "tableName" | "rowId";
const ID_FILTER_LABELS: Readonly<Record<IdFilterKey, string>> = {
	actorUserId: "Actor",
	tenantId: "Tenant",
	correlationId: "Correlation",
	tableName: "Table",
	rowId: "Row",
};
const ID_FILTER_KEYS: readonly IdFilterKey[] = ["actorUserId", "tenantId", "correlationId", "tableName", "rowId"];

/** The URL state with every filter, the search and the paging reset. */
const CLEARED_FILTERS: Partial<AuditLogUrlState> = {
	...Object.fromEntries(AUDIT_LOG_FILTER_KEYS.map((key) => [key, undefined])),
	search: undefined,
	page: LIST_FIRST_PAGE,
	cursor: undefined,
};

function getEntryRowId(entry: AuditTrailEntry): string {
	return entry.id;
}

/** `Changed 3 rows in users, refresh_tokens` — `null` when the entry changed nothing (a read). */
function describeChanges(entry: AuditTrailEntry): string | null {
	if (entry.changeCount === 0) {
		return null;
	}
	const rows: string = entry.changeCount === 1 ? "1 row" : `${String(entry.changeCount)} rows`;
	return `Changed ${rows} in ${entry.changedTables.join(", ")}`;
}

/** Two-line activity: a title line (badges + what) and one muted detail line, each truncated — rows stay one height. */
function ActivityLines({ title, detail, changes }: { readonly title: React.ReactNode; readonly detail: string; readonly changes: string | null }): React.JSX.Element {
	return (
		<div className="max-w-xl min-w-0 space-y-0.5">
			<div className="flex min-w-0 items-center gap-2">{title}</div>
			<p className="truncate font-mono text-xs text-muted-foreground" title={detail}>
				{detail}
			</p>
			{changes === null ? null : (
				<p className="truncate text-xs text-foreground/80" title={changes}>
					{changes}
				</p>
			)}
		</div>
	);
}

/** What happened: the request, or the database write no request made. */
function ActivityCell({ entry }: { readonly entry: AuditTrailEntry }): React.JSX.Element {
	if (entry.kind === "REQUEST") {
		return (
			<ActivityLines
				title={
					<>
						<AuditMethodBadge method={entry.method} />
						<span className="truncate font-mono text-xs font-medium" title={entry.endpoint}>
							{entry.endpoint}
						</span>
					</>
				}
				detail={entry.path}
				changes={describeChanges(entry)}
			/>
		);
	}
	return <BackgroundActivity entry={entry} />;
}

/** A single change reads as the change itself; a job's changes read as one database write. */
function BackgroundActivity({ entry }: { readonly entry: AuditTrailBackgroundEntry }): React.JSX.Element {
	const icon = <Database className="size-3.5 shrink-0 text-muted-foreground" aria-label="Database write" />;
	if (entry.changeCount === 1) {
		return (
			<ActivityLines
				title={
					<>
						{icon}
						<DataChangeOperationBadge operation={entry.operation} />
						<span className="truncate font-mono text-xs font-medium">{entry.changedTables.join(", ")}</span>
					</>
				}
				detail={entry.rowId ?? "whole table"}
				changes={null}
			/>
		);
	}
	return (
		<ActivityLines
			title={
				<>
					{icon}
					<span className="truncate text-xs font-medium">Database write · {entry.changeCount} rows</span>
				</>
			}
			detail={entry.changedTables.join(", ")}
			changes={null}
		/>
	);
}

/** Who acted, with the tenant underneath. */
function ActorCell({ entry }: { readonly entry: AuditTrailEntry }): React.JSX.Element {
	return (
		<div className="max-w-56 min-w-0 space-y-0.5">
			{entry.kind === "REQUEST" ? <AuditActorCell entry={entry} /> : <DataChangeActorCell entry={entry} />}
			{entry.tenant === null ? null : (
				<p className="truncate text-xs text-muted-foreground" title={entry.tenant.id}>
					{entry.tenant.name ?? entry.tenant.id}
				</p>
			)}
		</div>
	);
}

/** How a request ended; a background write has no HTTP outcome — it committed. */
function ResultCell({ entry }: { readonly entry: AuditTrailEntry }): React.JSX.Element {
	if (entry.kind === "BACKGROUND") {
		return <span className="text-xs text-muted-foreground">Committed</span>;
	}
	return (
		<div className="flex flex-col items-start gap-1">
			<AuditOutcomeBadge outcome={entry.outcome} status={entry.responseStatus} />
			{entry.errorCode === null ? null : <code className="max-w-40 truncate text-xs text-destructive">{entry.errorCode}</code>}
		</div>
	);
}

/** Two lines: device + credential, then address + class + country; a background write shows its database role. */
function ClientCell({ entry }: { readonly entry: AuditTrailEntry }): React.JSX.Element {
	if (entry.kind === "BACKGROUND") {
		return <span className="font-mono text-xs text-muted-foreground">{entry.databaseRole}</span>;
	}
	const software: string | null = describeClientSoftware(entry);
	return (
		<div className="max-w-64 min-w-0 space-y-1 text-xs" title={entry.userAgent ?? undefined}>
			<div className="flex min-w-0 items-center gap-1">
				{entry.deviceType === null ? null : <AuditDeviceBadge deviceType={entry.deviceType} />}
				<AuditAuthMethodBadge authMethod={entry.authMethod} />
				{software === null ? null : <span className="truncate text-muted-foreground">{software}</span>}
			</div>
			<div className="flex min-w-0 items-center gap-1 text-muted-foreground">
				<span className="truncate font-mono">{entry.ipAddress ?? "—"}</span>
				{entry.ipScope === null ? null : <AuditIpScopeBadge scope={entry.ipScope} />}
				{entry.geoCountry === null ? null : (
					<span className="truncate" title={countryName(entry.geoCountry)}>
						{countryFlag(entry.geoCountry) ?? entry.geoCountry} {entry.geoCity ?? countryName(entry.geoCountry)}
					</span>
				)}
			</div>
		</div>
	);
}

/** The chip of one id filter, clearing exactly that filter. */
function IdFilterChipFor({
	filterKey,
	value,
	onClear,
}: {
	readonly filterKey: IdFilterKey;
	readonly value: string;
	readonly onClear: (key: IdFilterKey) => void;
}): React.JSX.Element {
	const handleClear = React.useCallback((): void => {
		onClear(filterKey);
	}, [filterKey, onClear]);
	return <IdFilterChip label={ID_FILTER_LABELS[filterKey]} value={value} onClear={handleClear} />;
}

/** One entry as a phone-width card. */
function AuditTrailMobileCard({ entry }: { readonly entry: AuditTrailEntry }): React.JSX.Element {
	const changes = { label: "Changes", value: entry.changeCount === 0 ? "None" : `${String(entry.changeCount)} · ${entry.changedTables.join(", ")}` };
	if (entry.kind === "BACKGROUND") {
		return (
			<DataTableMobileCard
				item={entry}
				title="Database write"
				subtitle={formatDateTimeWithSeconds(entry.occurredAt)}
				badge={<DataChangeOperationBadge operation={entry.operation} />}
				fields={[{ label: "Attributed to", value: entry.actor?.email ?? entry.systemOperation ?? DATA_CHANGE_ACTOR_KIND_LABELS[entry.actorKind] }, changes]}
			/>
		);
	}
	return (
		<DataTableMobileCard
			item={entry}
			title={`${entry.method} ${entry.endpoint}`}
			subtitle={formatDateTimeWithSeconds(entry.occurredAt)}
			badge={<AuditOutcomeBadge outcome={entry.outcome} status={entry.responseStatus} />}
			fields={[
				{ label: "Actor", value: entry.actor?.email ?? entry.actor?.id ?? (entry.apiKeyId === null ? "Anonymous" : "API key") },
				{ label: "IP", value: entry.ipAddress ?? "—" },
				changes,
				...(entry.errorCode === null ? [] : [{ label: "Error", value: entry.errorCode }]),
			]}
		/>
	);
}

/**
 * Audit log — ONE timeline of everything that happened (ADR 025 + ADR 051):
 * every HTTP request (reads included, with the rows it changed) and every
 * database write no request made (jobs, schedulers, CLIs, manual SQL).
 *
 * The page owns the data (`GET /admin/audit-trail`), the columns and the
 * presentation; search, filters, sort and page live in the URL
 * (lib/url-state/audit-logs), so a filtered view can be shared. Clicking a
 * request opens its record (`?record=`), a background write its row change
 * (`?change=`), each in a drawer. Viewing this page is itself audited.
 */
export default function AuditLogView({ initialPage }: { readonly initialPage?: PrefetchedQuery<Envelope<AuditTrailEntry[]>> | undefined }): React.JSX.Element {
	const { api } = useAuth();
	const [urlState, updateUrlState] = useUrlState(AUDIT_LOG_URL_STATE);
	// The record / change open in a drawer — their own URL params, so opening one never resets the table's paging.
	const [recordSelection, updateRecordSelection] = useUrlState(AUDIT_LOG_RECORD_URL_STATE);
	const [changeSelection, updateChangeSelection] = useUrlState(DATA_CHANGE_RECORD_URL_STATE);
	const handleRowClick = React.useCallback(
		(entry: AuditTrailEntry): void => {
			if (entry.kind === "REQUEST") {
				updateRecordSelection({ record: entry.id });
			} else {
				updateChangeSelection({ change: entry.id });
			}
		},
		[updateRecordSelection, updateChangeSelection],
	);
	const handleRecordClose = React.useCallback((): void => {
		updateRecordSelection({ record: undefined });
	}, [updateRecordSelection]);
	const handleChangeClose = React.useCallback((): void => {
		updateChangeSelection({ change: undefined });
	}, [updateChangeSelection]);
	const isFiltered: boolean = isAuditLogFiltered(urlState);
	// New entries refetch the page on their own (SSE); Refresh stays for when the stream is down.
	const liveState = useAuditTrailLive();

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
	const trailQuery = api.auditTrail.list.useQuery(toAuditLogListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});

	// Stable rows reference (rule 16 — avoid re-renders via new array identity).
	const rows = React.useMemo(() => trailQuery.data?.data ?? [], [trailQuery.data]);
	const totalCount: number = readPaginatedTotal(trailQuery.data?.meta, rows.length);
	const isRefetching: boolean = trailQuery.isFetching && !trailQuery.isLoading;
	const { pagination, sorting, handleSortingChange } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: auditTrailListQuery,
		totalCount,
		nextCursor: readPaginatedNextCursor(trailQuery.data?.meta),
		resetKey: AUDIT_LOG_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined }),
		getRowId: getEntryRowId,
		onClearFilters: handleClearFilters,
		isFiltered,
	});

	const handleManualColumnFilterChange = React.useCallback(
		(filterKey: string, value: string | null): void => {
			const option: string = value ?? "";
			const reset = { page: LIST_FIRST_PAGE, cursor: undefined };
			if (filterKey === "kind") {
				updateUrlState({ kind: parseFilterOption(option, AuditTrailEntryKindSchema), ...reset });
			} else if (filterKey === "outcome") {
				updateUrlState({ outcome: parseFilterOption(option, AuditOutcomeSchema), ...reset });
			} else if (filterKey === "method") {
				updateUrlState({ method: parseFilterOption(option, AuditHttpMethodSchema), ...reset });
			} else if (filterKey === "authMethod") {
				updateUrlState({ authMethod: parseFilterOption(option, AuditAuthMethodSchema), ...reset });
			} else if (filterKey === "deviceType") {
				updateUrlState({ deviceType: parseFilterOption(option, DeviceTypeSchema), ...reset });
			} else if (filterKey === "ipScope") {
				updateUrlState({ ipScope: parseFilterOption(option, IpAddressScopeSchema), ...reset });
			} else if (filterKey === "actorKind") {
				updateUrlState({ actorKind: parseFilterOption(option, DataChangeActorKindSchema), ...reset });
			}
		},
		[updateUrlState],
	);

	const manualColumnFilters = React.useMemo(
		(): Readonly<Record<string, string>> => ({
			kind: urlState.kind ?? ALL_FILTER_OPTION,
			outcome: urlState.outcome ?? ALL_FILTER_OPTION,
			method: urlState.method ?? ALL_FILTER_OPTION,
			authMethod: urlState.authMethod ?? ALL_FILTER_OPTION,
			deviceType: urlState.deviceType ?? ALL_FILTER_OPTION,
			ipScope: urlState.ipScope ?? ALL_FILTER_OPTION,
			actorKind: urlState.actorKind ?? ALL_FILTER_OPTION,
		}),
		[urlState.kind, urlState.outcome, urlState.method, urlState.authMethod, urlState.deviceType, urlState.ipScope, urlState.actorKind],
	);

	const clearIdFilter = React.useCallback(
		(key: IdFilterKey): void => {
			updateUrlState({ [key]: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
		},
		[updateUrlState],
	);
	const activeIdFilters: readonly { readonly key: IdFilterKey; readonly value: string }[] = ID_FILTER_KEYS.flatMap((key: IdFilterKey) => {
		const value: string | undefined = urlState[key];
		return value === undefined ? [] : [{ key, value }];
	});

	const searchToolbar = React.useMemo(
		(): React.JSX.Element => (
			<DataTableSearchToolbar
				value={searchDraft}
				onChange={setSearchDraft}
				placeholder="Search by email, name, user id, path, table or correlation id..."
				ariaLabel="Search audit log"
			/>
		),
		[searchDraft, setSearchDraft],
	);

	const columns = React.useMemo<ColumnDef<DataTableFeatures, AuditTrailEntry>[]>(
		() => [
			{
				accessorKey: "occurredAt",
				header: "Time",
				enableSorting: true,
				enableHiding: false,
				cell: ({ row }): React.JSX.Element => (
					<div className="whitespace-nowrap tabular-nums">
						<p>{formatDateTimeWithSeconds(row.original.occurredAt)}</p>
						{row.original.kind === "REQUEST" ? <p className="text-xs text-muted-foreground">{row.original.durationMs} ms</p> : null}
					</div>
				),
			},
			{
				id: "activity",
				header: "Activity",
				enableHiding: false,
				cell: ({ row }): React.JSX.Element => <ActivityCell entry={row.original} />,
			},
			{
				id: "actor",
				header: "Actor",
				cell: ({ row }): React.JSX.Element => <ActorCell entry={row.original} />,
			},
			{
				id: "result",
				header: "Result",
				cell: ({ row }): React.JSX.Element => <ResultCell entry={row.original} />,
			},
			{
				id: "client",
				header: "Client",
				cell: ({ row }): React.JSX.Element => <ClientCell entry={row.original} />,
			},
		],
		[],
	);

	const mobileCardRender = React.useCallback((entry: AuditTrailEntry): React.ReactNode => <AuditTrailMobileCard entry={entry} />, []);

	const handleRefresh = React.useCallback((): void => {
		void trailQuery.refetch();
	}, [trailQuery]);

	if (trailQuery.isLoading && rows.length === 0) {
		return <TablePageSkeleton labels={AUDIT_LOG_LOADING_LABELS} shape={AUDIT_LOG_TABLE_PAGE} />;
	}

	if (trailQuery.error !== null && rows.length === 0) {
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
					<p className="mt-1 max-w-3xl text-sm text-muted-foreground">
						Everything that happened, in one timeline: every request to the API — reads included, successful or refused — with who did it, from which device and where, what
						was sent and what came back; and every row it changed in the database, with the row before and after. Database writes no request made — background jobs, scripts,
						direct SQL — appear here too. Secrets are redacted and personal data masked before anything is stored; records can never be edited or deleted, and opening this
						page is itself recorded.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<LivePill state={liveState} openTitle="Connected — new activity appears here on its own, no refresh needed." />
					<Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
						<RefreshCw className="size-3.5" />
						Refresh
					</Button>
				</div>
			</header>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Activity</CardTitle>
					<CardDescription>{totalCount} entries · newest first unless you sort by time · click an entry for its details</CardDescription>
					{activeIdFilters.length === 0 ? null : (
						<div className="flex flex-wrap gap-2 pt-2">
							{activeIdFilters.map(({ key, value }) => (
								<IdFilterChipFor key={key} filterKey={key} value={value} onClear={clearIdFilter} />
							))}
						</div>
					)}
				</CardHeader>
				<CardContent>
					<DataTable
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

			<AuditLogDrawer recordId={recordSelection.record} onClose={handleRecordClose} />
			<DataChangeDrawer changeId={changeSelection.change} onClose={handleChangeClose} />
		</div>
	);
}
