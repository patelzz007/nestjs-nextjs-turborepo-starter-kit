import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { EndpointAuthSchema, EndpointIndexSchema, type EndpointAuth, type EndpointRow } from "@workspace/docs-renderer/api-reference/endpoint-index";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { DataTable, type DataTableFeatures, type Filter, type FilterOption } from "@workspace/ui/components/data-table";
import { createElement, useMemo, type ReactElement } from "react";

import { docIcon, iconComponent, type IconName } from "@/lib/icons";

/** Where the build writes the index (src/routes/api-endpoints[.]json.ts). */
export const ENDPOINTS_URL = "/api-endpoints.json";
const ENDPOINTS_QUERY_KEY: readonly ["docs", "endpoints"] = ["docs", "endpoints"];
const PAGE_SIZE = 25;

export const AUTH_LABELS: Readonly<Record<EndpointAuth, string>> = {
	public: "Public",
	session: "Signed in",
	apiKey: "Merchant API key",
	refreshToken: "Refresh cookie",
	unknown: "Unknown",
};

/** The glyph beside each access choice in the filter: open to all, a signed-in user, a key, a cookie. */
export const AUTH_ICONS: Readonly<Record<EndpointAuth, IconName>> = {
	public: "globe",
	session: "logIn",
	apiKey: "keyRound",
	refreshToken: "cookie",
	unknown: "circleHelp",
};

/** The glyph size (px) in the filter lists, matching their 14px text. */
const FILTER_ICON_SIZE = 16;

const METHOD_VARIANTS: Readonly<Record<EndpointRow["method"], BadgeVariant>> = {
	get: "info-light",
	post: "success-light",
	put: "warning-light",
	patch: "warning-light",
	delete: "destructive",
};

/** Fetches and validates the endpoint index; a bad response fails the query rather than showing wrong rows. */
export async function fetchEndpoints(fetcher: typeof fetch = fetch): Promise<readonly EndpointRow[]> {
	const response = await fetcher(ENDPOINTS_URL);
	if (!response.ok) {
		throw new Error(`The endpoint list could not be loaded (HTTP ${String(response.status)}).`);
	}
	return EndpointIndexSchema.parse(await response.json());
}

/** Who may call an endpoint, in one line: the auth, SuperAdmin, and its permissions. */
export function accessSummary(row: EndpointRow): string {
	return [AUTH_LABELS[row.auth], ...(row.superAdminOnly ? ["SuperAdmin"] : []), ...row.permissions].join(" · ");
}

/** The filter options for one column, from the values the rows actually have, each with its icon when given one. */
export function optionsOf(
	rows: readonly EndpointRow[],
	pick: (row: EndpointRow) => string,
	label: (value: string) => string = (value) => value,
	icon?: (value: string) => IconName,
): readonly FilterOption[] {
	return [...new Set(rows.map(pick))].sort().map((value) => {
		const option = { value, label: label(value) };
		return icon === undefined ? option : { ...option, icon: createElement(iconComponent(icon(value)), { size: FILTER_ICON_SIZE }) };
	});
}

/** The guide a reference link points at: `/docs/technical/api-reference/pos#…` → `technical/api-reference/pos`. */
const GUIDE_ID_PATTERN = /^\/docs\/(?<id>[^#?]+)/;

/** A group's icon is its reference page's icon in the guide tree, so the filter and the sidebar agree. */
export function groupIcon(row: EndpointRow): IconName {
	return docIcon(GUIDE_ID_PATTERN.exec(row.href)?.groups?.id ?? "");
}

const COLUMNS: ColumnDef<DataTableFeatures, EndpointRow>[] = [
	{
		accessorKey: "method",
		header: "Method",
		cell: ({ row }) => (
			<Badge variant={METHOD_VARIANTS[row.original.method]} className="font-mono uppercase">
				{row.original.method}
			</Badge>
		),
	},
	{
		accessorKey: "path",
		header: "Path",
		cell: ({ row }) => (
			<a href={row.original.href} className="font-mono text-[0.8125rem] break-all text-foreground hover:text-(--docs-link) hover:underline">
				{row.original.path}
			</a>
		),
	},
	{
		accessorKey: "summary",
		header: "What it does",
		cell: ({ row }) => <span className="block max-w-md text-sm whitespace-normal text-(--docs-text-secondary)">{row.original.summary}</span>,
	},
	{ accessorKey: "group", header: "Group" },
	{
		id: "auth",
		accessorFn: (row) => row.auth,
		header: "Access",
		cell: ({ row }) => <span className="block max-w-56 font-mono text-xs whitespace-normal text-muted-foreground">{accessSummary(row.original)}</span>,
	},
];

/**
 * Every API operation in one sortable, filterable table (the shared DataTable, TanStack Table): method,
 * path, what it does, its reference group and who may call it. Each path links to its section of the
 * generated API reference. Loaded on demand with TanStack Query.
 */
export function EndpointsExplorer(): ReactElement {
	const query = useQuery({ queryKey: ENDPOINTS_QUERY_KEY, queryFn: () => fetchEndpoints(), staleTime: Number.POSITIVE_INFINITY });
	const rows = useMemo(() => query.data ?? [], [query.data]);
	const groupIcons = useMemo((): ReadonlyMap<string, IconName> => new Map(rows.map((row) => [row.group, groupIcon(row)])), [rows]);
	const filters = useMemo(
		(): Filter[] => [
			{
				key: "method",
				label: "Method",
				options: optionsOf(
					rows,
					(row) => row.method,
					(value) => value.toUpperCase(),
				),
			},
			{
				key: "auth",
				label: "Access",
				options: optionsOf(
					rows,
					(row) => row.auth,
					(value) => AUTH_LABELS[EndpointAuthSchema.catch("unknown").parse(value)],
					(value) => AUTH_ICONS[EndpointAuthSchema.catch("unknown").parse(value)],
				),
			},
			{
				key: "group",
				label: "Group",
				options: optionsOf(
					rows,
					(row) => row.group,
					(value) => value,
					(value) => groupIcons.get(value) ?? "fileText",
				),
			},
		],
		[rows, groupIcons],
	);

	if (query.isError) {
		return (
			<Alert variant="destructive">
				<AlertTitle>The endpoint list did not load</AlertTitle>
				<AlertDescription>Reload the page to try again. The generated API reference pages are in the guides under API.</AlertDescription>
			</Alert>
		);
	}

	return (
		<DataTable
			columns={COLUMNS}
			data={rows}
			filters={filters}
			searchKeys={["path", "summary", "group"]}
			toolbarLayout="fill"
			pageSize={PAGE_SIZE}
			isLoading={query.isPending}
			emptyState={{ title: "No endpoint matches", description: "Clear a filter or search for part of a path, such as tenants." }}
		/>
	);
}
