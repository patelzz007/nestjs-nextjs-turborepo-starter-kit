"use client";

import { createDataTableLabels, type DataTableLabels } from "@/lib/data-table/labels";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table/capabilities";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useManualHybridPagination } from "@/lib/data-table/use-manual-cursor-pagination";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Input } from "@workspace/ui/components/form/input";
import { cn } from "@workspace/ui/lib/core/utils";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { keepPreviousData } from "@tanstack/react-query";
import { Building2, Globe, Landmark, MapPin, TreePine } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";

import { useAuth } from "@workspace/client/lib/auth";
import { eqFilter, tableStateToListQuery, toListSearch, type SortColumnAliases } from "@workspace/client/lib/api/list-query";
import { cityListQuery, countryListQuery, stateListQuery, type CountryListSortField, type DataValue, type StateListSortField } from "@workspace/shared";

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

interface GeoTableStats {
	readonly regions: number;
	readonly subregions: number;
	readonly countries: number;
	readonly states: number;
	readonly cities: number;
}

interface GeoTableProps {
	readonly initialStats?: GeoTableStats | undefined;
}

type TabKey = "countries" | "states" | "cities";

// ── Helpers ────────────────────────────────────────────────────────────────

const OptionalStringSchema = z.string().optional().catch(undefined);
const OptionalCoordinateSchema = z
	.union([z.number(), z.string().transform((value): number => Number(value))])
	.optional()
	.catch(undefined);

/** Lenient per-row parse: bad fields fall back to defaults; non-object rows become `null` and are dropped. */
const GeoApiRowSchema = z
	.object({
		id: z.number().catch(0),
		name: z.string().catch(""),
		iso2: OptionalStringSchema,
		countryCode: OptionalStringSchema,
		stateCode: OptionalStringSchema,
		emoji: OptionalStringSchema,
		latitude: OptionalCoordinateSchema,
		longitude: OptionalCoordinateSchema,
		flag: z.boolean().optional().catch(undefined),
	})
	.nullable()
	.catch(null);

type GeoApiRow = NonNullable<z.infer<typeof GeoApiRowSchema>>;

const GeoApiRowsSchema = z.array(GeoApiRowSchema);

/** Envelope `data` is either a bare row array or a paginated `{ items }` object. */
const GeoEnvelopeSchema = z.object({
	data: z.union([GeoApiRowsSchema, z.object({ items: GeoApiRowsSchema })]),
});

function isGeoApiRow(row: GeoApiRow | null): row is GeoApiRow {
	return row !== null;
}

function extractRows(raw: DataValue | undefined): readonly GeoApiRow[] {
	const parsed = GeoEnvelopeSchema.safeParse(raw);
	if (!parsed.success) return [];
	const rows = Array.isArray(parsed.data.data) ? parsed.data.data : parsed.data.data.items;
	return rows.filter(isGeoApiRow);
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
				<div className="text-2xl font-bold">{value.toLocaleString()}</div>
			</CardContent>
		</Card>
	);
}

// ── Segmented tab control ──────────────────────────────────────────────────

const TAB_CONFIG: readonly { readonly key: TabKey; readonly label: string; readonly icon: typeof Globe }[] = [
	{ key: "countries", label: "Countries", icon: Globe },
	{ key: "states", label: "States", icon: MapPin },
	{ key: "cities", label: "Cities", icon: TreePine },
];

function SegmentedTabs({
	activeTab,
	onTabChange,
	counts,
}: {
	readonly activeTab: TabKey;
	readonly onTabChange: (tab: TabKey) => void;
	readonly counts: Readonly<Record<TabKey, number | undefined>>;
}): React.JSX.Element {
	const handleTabClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const tabKey = event.currentTarget.dataset.tabKey;
			if (tabKey === "countries" || tabKey === "states" || tabKey === "cities") {
				onTabChange(tabKey);
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
								{count.toLocaleString()}
							</span>
						) : null}
					</Button>
				);
			})}
		</div>
	);
}

// ── Column definitions ─────────────────────────────────────────────────────

function useCountryColumns(): ColumnDef<DataTableFeatures, GeoRow>[] {
	return useMemo(
		() => [
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
		[],
	);
}

function useStateColumns(): ColumnDef<DataTableFeatures, GeoRow>[] {
	return useMemo(
		() => [
			{ accessorKey: "id", header: "ID" },
			{ accessorKey: "name", header: "Name" },
			{ accessorKey: "countryCode", header: "Country" },
			{ accessorKey: "stateCode", header: "State Code" },
			{
				accessorKey: "latitude",
				header: "Lat",
				cell: ({ row }) => (row.getValue("latitude") != null ? Number(row.getValue("latitude")).toFixed(4) : "—"),
			},
			{
				accessorKey: "longitude",
				header: "Lng",
				cell: ({ row }) => (row.getValue("longitude") != null ? Number(row.getValue("longitude")).toFixed(4) : "—"),
			},
		],
		[],
	);
}

function useCityColumns(): ColumnDef<DataTableFeatures, GeoRow>[] {
	return useMemo(
		() => [
			{ accessorKey: "id", header: "ID" },
			{ accessorKey: "name", header: "Name" },
			{ accessorKey: "countryCode", header: "Country" },
			{ accessorKey: "stateCode", header: "State" },
			{
				accessorKey: "latitude",
				header: "Lat",
				cell: ({ row }) => (row.getValue("latitude") != null ? Number(row.getValue("latitude")).toFixed(4) : "—"),
			},
			{
				accessorKey: "longitude",
				header: "Lng",
				cell: ({ row }) => (row.getValue("longitude") != null ? Number(row.getValue("longitude")).toFixed(4) : "—"),
			},
		],
		[],
	);
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/** Country rows show the country's `iso2` in the `countryCode` column. */
const COUNTRY_SORT_ALIASES: SortColumnAliases<CountryListSortField> = { countryCode: "iso2" };
/** State rows show the state's own `iso2` in the `stateCode` column. */
const STATE_SORT_ALIASES: SortColumnAliases<StateListSortField> = { stateCode: "iso2" };

// ── Main component ─────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

export default function GeoView({ initialStats }: GeoTableProps): React.JSX.Element {
	const { api } = useAuth();

	const statsQuery = api.geo.stats.useQuery({});
	const stats = statsQuery.data?.data ?? initialStats;

	const [activeTab, setActiveTab] = useState<TabKey>("countries");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const [countryFilter, setCountryFilter] = useState("");
	const [sorting, setSorting] = useState<SortingState>([]);
	const isFiltered = debouncedSearch.trim().length > 0 || countryFilter.trim().length > 0;

	const handleClearFilters = useCallback((): void => {
		setSearch("");
		setCountryFilter("");
	}, []);

	const {
		listQuery: paginationQuery,
		bindListMeta,
		pagination: basePagination,
	} = useManualHybridPagination<GeoRow>(20, [activeTab, debouncedSearch, countryFilter, sorting], (row) => String(row.id), {
		onClearFilters: handleClearFilters,
		isFiltered,
	});

	const countryCodeFilter = useMemo(() => ({ countryCode: eqFilter(toListSearch(countryFilter)) }), [countryFilter]);
	const countriesInput = useMemo(
		() => tableStateToListQuery(countryListQuery, { pagination: paginationQuery, sorting, sortAliases: COUNTRY_SORT_ALIASES, search: debouncedSearch }),
		[paginationQuery, sorting, debouncedSearch],
	);
	const statesInput = useMemo(
		() => tableStateToListQuery(stateListQuery, { pagination: paginationQuery, sorting, sortAliases: STATE_SORT_ALIASES, search: debouncedSearch, filter: countryCodeFilter }),
		[paginationQuery, sorting, debouncedSearch, countryCodeFilter],
	);
	const citiesInput = useMemo(
		() => tableStateToListQuery(cityListQuery, { pagination: paginationQuery, sorting, search: debouncedSearch, filter: countryCodeFilter }),
		[paginationQuery, sorting, debouncedSearch, countryCodeFilter],
	);

	const countriesQuery = api.geo.countries.useQuery(countriesInput, { placeholderData: keepPreviousData });
	const statesQuery = api.geo.states.useQuery(statesInput, { placeholderData: keepPreviousData });
	const citiesQuery = api.geo.cities.useQuery(citiesInput, { placeholderData: keepPreviousData });

	const activeQuery = activeTab === "countries" ? countriesQuery : activeTab === "states" ? statesQuery : citiesQuery;
	const tableError: string | null = activeQuery.isError ? "Could not load geographic data. Clear search or sort and try again." : null;

	const countryRows = useMemo((): readonly GeoApiRow[] => extractRows(countriesQuery.data), [countriesQuery.data]);
	const stateRows = useMemo((): readonly GeoApiRow[] => extractRows(statesQuery.data), [statesQuery.data]);
	const cityRows = useMemo((): readonly GeoApiRow[] => extractRows(citiesQuery.data), [citiesQuery.data]);

	const countryItems = useMemo(
		(): GeoRow[] =>
			countryRows.map((c) => ({
				id: c.id,
				name: c.name,
				countryCode: c.iso2,
				flag: c.flag === true,
				emoji: c.emoji,
			})),
		[countryRows],
	);
	const stateItems = useMemo(
		(): GeoRow[] =>
			stateRows.map((s) => ({
				id: s.id,
				name: s.name,
				countryCode: s.countryCode,
				stateCode: s.iso2,
				latitude: s.latitude,
				longitude: s.longitude,
				flag: s.flag === true,
			})),
		[stateRows],
	);
	const cityItems = useMemo(
		(): GeoRow[] =>
			cityRows.map((c) => ({
				id: c.id,
				name: c.name,
				countryCode: c.countryCode,
				stateCode: c.stateCode,
				latitude: c.latitude,
				longitude: c.longitude,
				flag: c.flag === true,
			})),
		[cityRows],
	);

	const items = activeTab === "countries" ? countryItems : activeTab === "states" ? stateItems : cityItems;

	const totalCount = readPaginatedTotal(activeQuery.data?.meta, 0);
	const pagination = useMemo(() => ({ ...basePagination, totalCount }), [basePagination, totalCount]);

	useEffect((): void => {
		bindListMeta(readPaginatedNextCursor(activeQuery.data?.meta) ?? null);
	}, [activeQuery.data?.meta, bindListMeta]);

	const countryColumns = useCountryColumns();
	const stateColumns = useStateColumns();
	const cityColumns = useCityColumns();

	const columns = useMemo(() => {
		switch (activeTab) {
			case "countries":
				return countryColumns;
			case "states":
				return stateColumns;
			case "cities":
				return cityColumns;
		}
	}, [activeTab, countryColumns, stateColumns, cityColumns]);

	const countryLabels = useMemo((): DataTableLabels => createDataTableLabels({ actionsMenuTitle: "Country actions", openRowMenu: "Open country row menu" }), []);
	const stateLabels = useMemo((): DataTableLabels => createDataTableLabels({ actionsMenuTitle: "State actions", openRowMenu: "Open state row menu" }), []);
	const cityLabels = useMemo((): DataTableLabels => createDataTableLabels({ actionsMenuTitle: "City actions", openRowMenu: "Open city row menu" }), []);

	const labels = useMemo(() => {
		switch (activeTab) {
			case "countries":
				return countryLabels;
			case "states":
				return stateLabels;
			case "cities":
				return cityLabels;
		}
	}, [activeTab, countryLabels, stateLabels, cityLabels]);

	const handleCountryFilterChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setCountryFilter(event.target.value);
	}, []);

	const handleSearchChange = useCallback((value: string): void => {
		setSearch(value);
	}, []);

	const handleTabChange = useCallback((tab: TabKey) => {
		setActiveTab(tab);
		setSearch("");
		setCountryFilter("");
		setSorting([]);
	}, []);

	const handleManualSortingChange = useCallback((newSorting: SortingState) => {
		setSorting(newSorting);
	}, []);

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
								value: item.latitude !== undefined && item.longitude !== undefined ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}` : "—",
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
							value: item.latitude !== undefined && item.longitude !== undefined ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}` : "—",
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
				<DataTableSearchToolbar value={search} onChange={handleSearchChange} placeholder={`Search ${activeTab}...`} className="relative w-[250px]" />
				{activeTab === "states" || activeTab === "cities" ? (
					<Input placeholder="Country code" value={countryFilter} onChange={handleCountryFilterChange} className="w-[120px]" />
				) : null}
			</div>
		),
		[activeTab, search, countryFilter, handleCountryFilterChange, handleSearchChange],
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
					<StatCard label="Regions" value={stats.regions} icon={<Globe className="size-4 text-muted-foreground" />} />
					<StatCard label="Subregions" value={stats.subregions} icon={<Landmark className="size-4 text-muted-foreground" />} />
					<StatCard label="Countries" value={stats.countries} icon={<Building2 className="size-4 text-muted-foreground" />} />
					<StatCard label="States" value={stats.states} icon={<MapPin className="size-4 text-muted-foreground" />} />
					<StatCard label="Cities" value={stats.cities} icon={<TreePine className="size-4 text-muted-foreground" />} />
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
							data={[...items]}
							columns={columns}
							labels={labels}
							checkbox={checkbox}
							enableColumnVisibility
							mobileCardRender={mobileCardRender}
							pagination={pagination}
							sorting={sorting}
							pageSizeOptions={PAGE_SIZE_OPTIONS}
							onManualSortingChange={handleManualSortingChange}
							toolbarContent={toolbarContent}
							error={tableError}
							isLoading={activeTab === "countries" ? countriesQuery.isLoading : activeTab === "states" ? statesQuery.isLoading : citiesQuery.isLoading}
						/>
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}
