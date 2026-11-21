"use client";

import type * as React from "react";

import { PLATFORM_DISPLAY_REGION, utcEpochMs } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import {
	DataTable,
	type DataTableColumns,
	type DataTableDetail,
	type DataTableFilter,
	type DataTableLayout,
	type DataTablePaging,
	type DataTableSearch,
	type DataTableSortingOptions,
} from "@workspace/ui/components/data-table";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { z } from "zod";

/** A log line's level: one source for the type and its values. */
const logLevelSchema = z.enum(["error", "warn", "info", "debug"]);
type LogLevel = z.output<typeof logLevelSchema>;

const LEVEL_NAMES: Readonly<Record<LogLevel, string>> = { error: "Error", warn: "Warning", info: "Info", debug: "Debug" };

/** One log line. */
interface LogEntry {
	readonly id: string;
	readonly atEpochMs: number;
	readonly level: LogLevel;
	readonly service: string;
	readonly message: string;
	readonly requestId: string;
	readonly durationMs: number;
}

const SERVICES: readonly string[] = ["api", "worker", "web", "payments"];
const LEVELS: readonly LogLevel[] = ["info", "info", "debug", "warn", "info", "error"];
const MESSAGES: readonly string[] = [
	"GET /v1/orders 200",
	"Job sync-inventory finished",
	"Cache miss for tenant settings",
	"Slow query on audit_log (812 ms)",
	"POST /v1/checkout 201",
	"Payment provider timed out",
];

const YEAR = 2026;
const MONTH = 11;
const FIRST_DAY = 12;
const LOG_COUNT = 36;
/** Sample spacing: a line every 4 hours 10 minutes, so the lines spread over about a week. */
const MINUTES_BETWEEN_LINES = 250;
const MS_PER_MINUTE = 60_000;
const BASE_DURATION_MS = 12;
const DURATION_STEP_MS = 37;
const DURATION_SPREAD_MS = 400;
const REQUEST_ID_RADIX = 16;
const REQUEST_ID_SEED = 0xa3f1;
const REQUEST_ID_STEP = 7919;

const START_EPOCH_MS = utcEpochMs(YEAR, MONTH, FIRST_DAY);

/** Picks the item at `index`, wrapping round the list. */
function cycle<TItem>(items: readonly TItem[], index: number, fallback: TItem): TItem {
	return items.at(index % items.length) ?? fallback;
}

export const LOGS: readonly LogEntry[] = Array.from({ length: LOG_COUNT }, (_line, index): LogEntry => ({
	id: `log-${String(index + 1)}`,
	atEpochMs: START_EPOCH_MS + index * MINUTES_BETWEEN_LINES * MS_PER_MINUTE,
	level: cycle(LEVELS, index, "info"),
	service: cycle(SERVICES, index, "api"),
	message: cycle(MESSAGES, index, ""),
	requestId: `req_${(REQUEST_ID_SEED + index * REQUEST_ID_STEP).toString(REQUEST_ID_RADIX)}`,
	durationMs: BASE_DURATION_MS + ((index * DURATION_STEP_MS) % DURATION_SPREAD_MS),
}));

const LEVEL_BADGE: Readonly<Record<LogLevel, "destructive-light" | "warning-light" | "info-light" | "invert-light">> = {
	error: "destructive-light",
	warn: "warning-light",
	info: "info-light",
	debug: "invert-light",
};

function LevelBadge({ level }: { readonly level: LogLevel }): React.JSX.Element {
	return (
		<Badge variant={LEVEL_BADGE[level]} className="font-mono uppercase">
			{level}
		</Badge>
	);
}

function getLogId(entry: LogEntry): string {
	return entry.id;
}

const COLUMNS: DataTableColumns<LogEntry> = [
	{ accessorKey: "atEpochMs", header: "Time", size: 170, cell: ({ row }): string => formatEpochMs(row.original.atEpochMs, "dateTime", PLATFORM_DISPLAY_REGION) },
	{ accessorKey: "level", header: "Level", size: 90, cell: ({ row }): React.JSX.Element => <LevelBadge level={row.original.level} /> },
	{ accessorKey: "service", header: "Service", size: 110, meta: { cellClassName: "font-mono text-xs" } },
	{ accessorKey: "message", header: "Message", size: 320, meta: { cellClassName: "font-mono text-xs" } },
	{ accessorKey: "requestId", header: "Request", size: 130, meta: { cellClassName: "font-mono text-xs text-muted-foreground" } },
];

// `zone` is left out: a log time is a timestamp, read on the reader's own calendar.
const FILTERS: readonly DataTableFilter[] = [
	{ kind: "date-range", column: "atEpochMs", label: "Time" },
	{
		kind: "multi-select",
		column: "level",
		label: "Level",
		options: logLevelSchema.options.map((level) => ({ value: level, label: LEVEL_NAMES[level] })),
	},
	{ kind: "multi-select", column: "service", label: "Service", options: SERVICES.map((service) => ({ value: service, label: service })) },
];

const SEARCH: DataTableSearch<LogEntry> = { keys: ["message", "requestId"] };
const SORTING: DataTableSortingOptions = { initial: [{ id: "atEpochMs", desc: true }] };
const PAGING: DataTablePaging = { pageSize: 10 };
const LAYOUT: DataTableLayout = { density: "compact" };

/** The panel's heading for a log line. */
export function logPanelTitle(entry: LogEntry): string {
	return `${entry.service} · ${entry.level}`;
}

function renderLogPanel(entry: LogEntry): React.JSX.Element {
	return (
		<dl className="grid gap-4 text-sm">
			<div className="grid gap-1">
				<dt className="text-muted-foreground">Time</dt>
				<dd className="font-medium">{formatEpochMs(entry.atEpochMs, "preciseTime", PLATFORM_DISPLAY_REGION)}</dd>
			</div>
			<div className="grid gap-1">
				<dt className="text-muted-foreground">Message</dt>
				<dd className="font-mono text-xs break-all">{entry.message}</dd>
			</div>
			<div className="grid gap-1">
				<dt className="text-muted-foreground">Request</dt>
				<dd className="font-mono text-xs">{entry.requestId}</dd>
			</div>
			<div className="grid gap-1">
				<dt className="text-muted-foreground">Duration</dt>
				<dd className="font-medium tabular-nums">{entry.durationMs} ms</dd>
			</div>
		</dl>
	);
}

/** The panel repeats the request id, so that column hides while it is open. */
const DETAIL: DataTableDetail<LogEntry> = { mode: "panel", render: renderLogPanel, title: logPanelTitle, hideColumnsWhileOpen: ["requestId"] };

/**
 * Recipe: a log viewer. A time range (date-range filter), level and service (multi-select filters with live counts)
 * and a search over the message narrow the lines; clicking a line opens it in the side panel, and ↑/↓ step through.
 */
export function DataTableRecipeLogs(): React.JSX.Element {
	return <DataTable data={LOGS} columns={COLUMNS} getRowId={getLogId} search={SEARCH} filters={FILTERS} sorting={SORTING} paging={PAGING} layout={LAYOUT} detail={DETAIL} />;
}
