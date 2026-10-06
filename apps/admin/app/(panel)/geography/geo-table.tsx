"use client";

import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table/capabilities";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { formatCoordinate, formatCoordinatePair, formatCount } from "@/lib/format/numbers";
import { initialDataOption, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { useTableTextDraft } from "@/lib/data-table/use-table-text-draft";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import {
	CITY_SORT_ALIASES,
	COUNTRY_SORT_ALIASES,
	GEO_PAGE_SIZE_OPTIONS,
	GEO_URL_STATE,
	GeoTabSchema,
	STATE_SORT_ALIASES,
	toCitiesListQuery,
	toCountriesListQuery,
	toStatesListQuery,
	type GeoTab,
	type GeoTabPage,
} from "@/lib/url-state/geography";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/data-table";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/core/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { keepPreviousData } from "@tanstack/react-query";
import { Building2, Globe, Landmark, MapPin, TreePine } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, type ReactNode } from "react";

import { useAuth } from "@workspace/client/lib/auth";
import { toListSearch, type ListSortSpec, type SortColumnAliases } from "@workspace/client/lib/api/list-query";
import { cityListQuery, countryListQuery, stateListQuery, type CityListItem, type CountryListItem, type Envelope, type GeoStats, type StateListItem } from "@workspace/shared";

// ── Types ──────────────────────────────────────────────────────────────────

interface GeoRow {
	readonly id: number;
	readonly name: string;
	readonly countryCode?: string | undefined;
	readonly stateCode?: string | undefined;
	readonly latitude?: number | undefined;
	readonly longitude?: number | undefined;
	readonly emoji?: string | undefined;
	readonly flag?: boolean | undefined;
}

export interface GeoViewProps {
	/** The stats envelope the server prefetched — seeds the stats query (with the server's answer time), so the client does not fetch them again. */
	readonly initialStats?: Envelope<GeoStats> | undefined;
	/** The active tab's page the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<GeoTabPage> | undefined;
}

// ── Row mapping ────────────────────────────────────────────────────────────
// Responses are already validated against the shared contract by the
// transport (lib/api/response-contract), so the rows are typed here.

function toCountryRow(country: CountryListItem): GeoRow {
	return { id: country.id, name: country.name, countryCode: country.iso2 ?? undefined, flag: country.flag, emoji: country.emoji ?? undefined };
}

function toStateRow(state: StateListItem): GeoRow {
	return {
		id: state.id,
		name: state.name,
		countryCode: state.countryCode,
		stateCode: state.iso2 ?? undefined,
		latitude: state.latitude ?? undefined,
		longitude: state.longitude ?? undefined,
		flag: state.flag,
	};
}

function toCityRow(city: CityListItem): GeoRow {
	return {
		id: city.id,
		name: city.name,
		countryCode: city.countryCode,
		stateCode: city.stateCode,
		latitude: city.latitude,
		longitude: city.longitude,
		flag: city.flag,
	};
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { readonly label: string; readonly value: number; readonly icon: ReactNode }): React.JSX.Element {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{label}</CardTitle>
				{icon}
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold">{formatCount(value)}</div>
			</CardContent>
		</Card>
	);
}

/** The five stat cards, in display order. */
const STAT_CARDS: readonly { readonly key: keyof GeoStats; readonly label: string; readonly icon: ReactNode }[] = [
	{ key: "regions", label: "Regions", icon: <Globe className="size-4 text-muted-foreground" /> },
	{ key: "subregions", label: "Subregions", icon: <Landmark className="size-4 text-muted-foreground" /> },
	{ key: "countries", label: "Countries", icon: <Building2 className="size-4 text-muted-foreground" /> },
	{ key: "states", label: "States", icon: <MapPin className="size-4 text-muted-foreground" /> },
	{ key: "cities", label: "Cities", icon: <TreePine className="size-4 text-muted-foreground" /> },
];

// ── Segmented tab control ──────────────────────────────────────────────────

const TAB_CONFIG: readonly { readonly key: GeoTab; readonly label: string; readonly icon: typeof Globe }[] = [
	{ key: "countries", label: "Countries", icon: Globe },
	{ key: "states", label: "States", icon: MapPin },
	{ key: "cities", label: "Cities", icon: TreePine },
];

function SegmentedTabs({
	activeTab,
	onTabChange,
	counts,
}: {
	readonly activeTab: GeoTab;
	readonly onTabChange: (tab: GeoTab) => void;
	readonly counts: Readonly<Record<GeoTab, number | undefined>>;
}): React.JSX.Element {
	const handleTabClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const tab = GeoTabSchema.safeParse(event.currentTarget.dataset.tabKey);
			if (tab.success) {
				onTabChange(tab.data);
			}
		},
		[onTabChange],
	);

	return (
		<div className="inline-flex items-center gap-0.5 rounded-xl border border-border/60 bg-muted/50 p-1">
			{TAB_CONFIG.map(({ key, label, icon: Icon }) => {
				const isActive = key === activeTab;
				const count = counts[key];
				return (
					<Button
						key={key}
						type="button"
						variant={isActive ? "secondary" : "ghost"}
						size="sm"
						data-tab-key={key}
						onClick={handleTabClick}
						className={cn(
							"gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
							isActive ? "bg-background text-foreground shadow-sm ring-1 ring-border/40" : "text-muted-foreground hover:bg-muted hover:text-foreground",
						)}>
						<Icon className="size-4" />
						<span>{label}</span>
						{count !== undefined ? (
							<span
								className={`rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/70"} `}>
								{formatCount(count)}
							</span>
						) : null}
					</Button>
				);
			})}
		</div>
	);
}

// ── Per-tab table config (module scope: built once, stable identities) ────

const LAT_LNG_COLUMNS: ColumnDef<DataTableFeatures, GeoRow>[] = [
	{
		accessorKey: "latitude",
		header: "Lat",
		cell: ({ row }) => formatCoordinate(row.original.latitude),
	},
	{
		accessorKey: "longitude",
		header: "Lng",
		cell: ({ row }) => formatCoordinate(row.original.longitude),
	},
];

const GEO_COLUMNS: Readonly<Record<GeoTab, ColumnDef<DataTableFeatures, GeoRow>[]>> = {
	countries: [
		{ accessorKey: "id", header: "ID" },
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row }) => (
				<span className="flex items-center gap-2">
					{row.original.emoji ? <span className="text-lg">{row.original.emoji}</span> : null}
					{String(row.getValue("name"))}
				</span>
			),
		},
		{ accessorKey: "countryCode", header: "ISO2" },
		{
			accessorKey: "flag",
			header: "Active",
			cell: ({ row }) => (row.getValue("flag") ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Inactive</Badge>),
		},
	],
	states: [
		{ accessorKey: "id", header: "ID" },
		{ accessorKey: "name", header: "Name" },
		{ accessorKey: "countryCode", header: "Country" },
		{ accessorKey: "stateCode", header: "State Code" },
		...LAT_LNG_COLUMNS,
	],
	cities: [
		{ accessorKey: "id", header: "ID" },
		{ accessorKey: "name", header: "Name" },
		{ accessorKey: "countryCode", header: "Country" },
		{ accessorKey: "stateCode", header: "State" },
		...LAT_LNG_COLUMNS,
	],
};

const GEO_LABELS: Readonly<Record<GeoTab, UiKitLabelsOverride<"dataTable">>> = {
	countries: { actionsMenuTitle: "Country actions", openRowMenu: "Open country row menu" },
	states: { actionsMenuTitle: "State actions", openRowMenu: "Open state row menu" },
	cities: { actionsMenuTitle: "City actions", openRowMenu: "Open city row menu" },
};

const GEO_SORT: Readonly<Record<GeoTab, { readonly sortSpec: ListSortSpec<string>; readonly sortAliases: SortColumnAliases<string> }>> = {
	countries: { sortSpec: countryListQuery, sortAliases: COUNTRY_SORT_ALIASES },
	states: { sortSpec: stateListQuery, sortAliases: STATE_SORT_ALIASES },
	cities: { sortSpec: cityListQuery, sortAliases: CITY_SORT_ALIASES },
};

// ── Main component ─────────────────────────────────────────────────────────

/**
 * `/geography` — tab, search, country-code filter, sort and page live in the
 * URL (lib/url-state/geography); only the active tab's list is fetched. The
 * server page prefetches the active tab's page; it seeds that tab's query
 * only while the URL state is the one the server fetched.
 */
export default function GeoView({ initialStats, initialPage }: GeoViewProps): React.JSX.Element {
	const { api } = useAuth();

	const statsQuery = api.geo.stats.useQuery({}, initialDataOption(initialStats));
	const stats = statsQuery.data?.data;

	const [urlState, updateUrlState] = useUrlState(GEO_URL_STATE);
	const activeTab: GeoTab = urlState.tab;
	const isFiltered = urlState.search !== undefined || urlState.countryCode !== undefined;

	const commitSearch = useCallback(
		(value: string): void => {
			updateUrlState({ search: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const commitCountryCode = useCallback(
		(value: string): void => {
			updateUrlState({ countryCode: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const [searchDraft, setSearchDraft] = useTableTextDraft(urlState.search, commitSearch);
	const [countryCodeDraft, setCountryCodeDraft] = useTableTextDraft(urlState.countryCode, commitCountryCode);

	const handleClearFilters = useCallback((): void => {
		updateUrlState({ search: undefined, countryCode: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	// The server prefetched one tab's page for one URL state: it seeds that tab's
	// query only while the URL is still in that state (`stateKey` includes `?tab=`).
	const prefetchedPage: GeoTabPage | undefined = prefetchedDataFor(initialPage, GEO_URL_STATE.serialize(urlState));
	const countriesQuery = api.geo.countries.useQuery(toCountriesListQuery(urlState), {
		placeholderData: keepPreviousData,
		enabled: activeTab === "countries",
		...initialDataOption(prefetchedPage?.tab === "countries" ? prefetchedPage.envelope : undefined),
	});
	const statesQuery = api.geo.states.useQuery(toStatesListQuery(urlState), {
		placeholderData: keepPreviousData,
		enabled: activeTab === "states",
		...initialDataOption(prefetchedPage?.tab === "states" ? prefetchedPage.envelope : undefined),
	});
	const citiesQuery = api.geo.cities.useQuery(toCitiesListQuery(urlState), {
		placeholderData: keepPreviousData,
		enabled: activeTab === "cities",
		...initialDataOption(prefetchedPage?.tab === "cities" ? prefetchedPage.envelope : undefined),
	});

	const activeQuery = activeTab === "countries" ? countriesQuery : activeTab === "states" ? statesQuery : citiesQuery;
	const tableError: string | null = activeQuery.isError ? "Could not load geographic data. Clear search or sort and try again." : null;

	const countryItems = useMemo((): GeoRow[] => (countriesQuery.data?.data ?? []).map(toCountryRow), [countriesQuery.data]);
	const stateItems = useMemo((): GeoRow[] => (statesQuery.data?.data ?? []).map(toStateRow), [statesQuery.data]);
	const cityItems = useMemo((): GeoRow[] => (citiesQuery.data?.data ?? []).map(toCityRow), [citiesQuery.data]);

	const items = activeTab === "countries" ? countryItems : activeTab === "states" ? stateItems : cityItems;

	const { pagination, sorting, handleSortingChange } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		...GEO_SORT[activeTab],
		totalCount: readPaginatedTotal(activeQuery.data?.meta, 0),
		nextCursor: readPaginatedNextCursor(activeQuery.data?.meta),
		resetKey: GEO_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined }),
		getRowId: getGeoRowId,
		onClearFilters: handleClearFilters,
		isFiltered,
	});

	const handleCountryFilterChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setCountryCodeDraft(event.target.value);
		},
		[setCountryCodeDraft],
	);

	/** A new tab starts from that tab's defaults: every list param is cleared. */
	const handleTabChange = useCallback(
		(tab: GeoTab): void => {
			updateUrlState({ ...GEO_URL_STATE.defaults, tab });
		},
		[updateUrlState],
	);

	const tabCounts = useMemo(
		() => ({
			countries: stats?.countries,
			states: stats?.states,
			cities: stats?.cities,
		}),
		[stats],
	);

	const mobileCardRender = useCallback(
		(item: GeoRow): React.ReactNode => {
			if (activeTab === "countries") {
				return (
					<DataTableMobileCard
						item={item}
						title={
							<span className="flex items-center gap-2">
								{item.emoji !== undefined ? <span>{item.emoji}</span> : null}
								{item.name}
							</span>
						}
						subtitle={item.countryCode}
						fields={[{ label: "ID", value: item.id }]}
					/>
				);
			}
			if (activeTab === "states") {
				return (
					<DataTableMobileCard
						item={item}
						title={item.name}
						subtitle={item.countryCode}
						fields={[
							{ label: "State code", value: item.stateCode ?? "—" },
							{
								label: "Coordinates",
								value: formatCoordinatePair(item.latitude, item.longitude),
							},
						]}
					/>
				);
			}
			return (
				<DataTableMobileCard
					item={item}
					title={item.name}
					subtitle={`${item.countryCode ?? "—"} · ${item.stateCode ?? "—"}`}
					fields={[
						{ label: "ID", value: item.id },
						{
							label: "Coordinates",
							value: formatCoordinatePair(item.latitude, item.longitude),
						},
					]}
				/>
			);
		},
		[activeTab],
	);

	const toolbarContent = useMemo(
		() => (
			<div className="flex items-center gap-2">
				<DataTableSearchToolbar value={searchDraft} onChange={setSearchDraft} placeholder={`Search ${activeTab}...`} className="relative w-[250px]" />
				{activeTab === "states" || activeTab === "cities" ? (
					<Input placeholder="Country code" aria-label="Country code" value={countryCodeDraft} onChange={handleCountryFilterChange} className="w-[120px]" />
				) : null}
			</div>
		),
		[activeTab, searchDraft, setSearchDraft, countryCodeDraft, handleCountryFilterChange],
	);

	const checkbox = useMemo(() => buildReadOnlyTableCheckbox(`geo-${activeTab}.csv`), [activeTab]);

	return (
		<div className="space-y-6 p-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Geographic Data</h1>
				<p className="text-sm text-muted-foreground">Manage regions, countries, states, and cities.</p>
			</div>

			{stats ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					{STAT_CARDS.map(({ key, label, icon }) => (
						<StatCard key={key} label={label} value={stats[key]} icon={icon} />
					))}
				</div>
			) : null}

			<div className="space-y-4">
				<SegmentedTabs activeTab={activeTab} onTabChange={handleTabChange} counts={tabCounts} />

				<AnimatePresence mode="wait">
					<motion.div
						key={activeTab}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.2, ease: "easeInOut" }}>
						<DataTable
							data={items}
							columns={GEO_COLUMNS[activeTab]}
							labels={GEO_LABELS[activeTab]}
							checkbox={checkbox}
							enableColumnVisibility
							mobileCardRender={mobileCardRender}
							pagination={pagination}
							sorting={sorting}
							pageSizeOptions={GEO_PAGE_SIZE_OPTIONS}
							onManualSortingChange={handleSortingChange}
							toolbarContent={toolbarContent}
							error={tableError}
							isLoading={activeQuery.isLoading}
						/>
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}

function getGeoRowId(row: GeoRow): string {
	return String(row.id);
}
