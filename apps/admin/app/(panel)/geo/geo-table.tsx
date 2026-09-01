"use client";

import { createDataTableLabels, type DataTableLabels } from "@/lib/data-table-labels";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Input } from "@workspace/ui/components/form/input";
import { cn } from "@workspace/ui/lib/utils";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { keepPreviousData } from "@tanstack/react-query";
import { Building2, Download, Globe, Landmark, MapPin, Search, TreePine, Upload } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useAuth } from "@workspace/client/lib/auth";

// ── Types ──────────────────────────────────────────────────────────────────

interface GeoRow {
	readonly id: number;
	readonly name: string;
	readonly countryCode?: string;
	readonly stateCode?: string;
	readonly latitude?: number;
	readonly longitude?: number;
	readonly emoji?: string;
	readonly flag?: boolean;
}

interface PageMeta {
	readonly total: number;
	readonly hasNext: boolean;
}

interface ExtractedData {
	readonly rows: readonly unknown[];
	readonly meta: PageMeta;
}

interface GeoTableStats {
	readonly regions: number;
	readonly subregions: number;
	readonly countries: number;
	readonly states: number;
	readonly cities: number;
}

interface GeoTableProps {
	readonly initialStats?: GeoTableStats;
}

type TabKey = "countries" | "states" | "cities";

// ── Helpers ────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
	return v !== null && typeof v === "object" && !Array.isArray(v);
}

function readStr(obj: Record<string, unknown>, key: string): string {
	return typeof obj[key] === "string" ? obj[key] : "";
}

function readNum(obj: Record<string, unknown>, key: string): number {
	return typeof obj[key] === "number" ? obj[key] : 0;
}

function readStrN(obj: Record<string, unknown>, key: string): string | undefined {
	return typeof obj[key] === "string" ? obj[key] : undefined;
}

function readNumN(obj: Record<string, unknown>, key: string): number | undefined {
	const v = obj[key];
	return typeof v === "number" ? v : typeof v === "string" ? Number(v) : undefined;
}

function readMeta(m: unknown): PageMeta {
	if (m === null || typeof m !== "object") return { total: 0, hasNext: false };
	const obj: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(m)) {
		obj[k] = v;
	}
	const total = typeof obj.total === "number" ? obj.total : 0;
	const hasNext = obj.hasNext === true || obj.hasMore === true;
	return { total, hasNext };
}

function extractFromQuery(raw: unknown): ExtractedData {
	if (raw === null || typeof raw !== "object") return { rows: [], meta: { total: 0, hasNext: false } };

	const env: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(raw)) {
		env[k] = v;
	}
	const data = env.data;

	if (Array.isArray(data)) {
		return { rows: data, meta: readMeta(env.meta) };
	}

	if (data !== null && typeof data === "object" && "items" in data) {
		const dataObj: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(data)) {
			dataObj[k] = v;
		}
		const rawItems: unknown[] = Array.isArray(dataObj.items) ? dataObj.items : [];
		return {
			rows: rawItems,
			meta: { total: readNum(dataObj, "total"), hasNext: dataObj.hasNext === true || dataObj.hasMore === true },
		};
	}

	return { rows: [], meta: { total: 0, hasNext: false } };
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
	readonly counts: Partial<Record<TabKey, number>>;
}): React.JSX.Element {
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
						onClick={(): void => {
							onTabChange(key);
						}}
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

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);
	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);
		return (): void => {
			clearTimeout(handler);
		};
	}, [value, delay]);
	return debouncedValue;
}

function sortingToApiSort(sorting: SortingState): string | undefined {
	if (sorting.length === 0) return undefined;
	const first = sorting[0];
	if (first === undefined) return undefined;
	return first.desc ? `-${first.id}` : first.id;
}

// ── Main component ─────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

export default function GeoView({ initialStats }: GeoTableProps): React.JSX.Element {
	const { api } = useAuth();

	const statsQuery = api.geo.stats.useQuery({});
	const stats = statsQuery.data?.data ?? initialStats;

	const [activeTab, setActiveTab] = useState<TabKey>("countries");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebounce(search, 300);
	const [page, setPage] = useState(1);
	const [pageLimit, setPageLimit] = useState(20);
	const [countryFilter, setCountryFilter] = useState("");
	const [sorting, setSorting] = useState<SortingState>([]);

	const prevSearchRef = useRef(debouncedSearch);
	const prevCountryRef = useRef(countryFilter);
	const prevSortRef = useRef(sorting);
	useEffect(() => {
		const searchChanged = debouncedSearch !== prevSearchRef.current;
		const countryChanged = countryFilter !== prevCountryRef.current;
		const sortChanged = sorting !== prevSortRef.current;
		if (searchChanged || countryChanged || sortChanged) {
			setPage(1);
		}
		prevSearchRef.current = debouncedSearch;
		prevCountryRef.current = countryFilter;
		prevSortRef.current = sorting;
	}, [debouncedSearch, countryFilter, sorting]);

	const apiSort = useMemo(() => sortingToApiSort(sorting), [sorting]);

	const countriesQuery = api.geo.countries.useQuery({ page, limit: pageLimit, search: debouncedSearch || undefined, sort: apiSort }, { placeholderData: keepPreviousData });
	const statesQuery = api.geo.states.useQuery(
		{ page, limit: pageLimit, search: debouncedSearch || undefined, sort: apiSort, countryCode: countryFilter || undefined },
		{ placeholderData: keepPreviousData },
	);
	const citiesQuery = api.geo.cities.useQuery(
		{ page, limit: pageLimit, search: debouncedSearch || undefined, sort: apiSort, countryCode: countryFilter || undefined },
		{ placeholderData: keepPreviousData },
	);

	const activeQuery = activeTab === "countries" ? countriesQuery : activeTab === "states" ? statesQuery : citiesQuery;
	const tableError: string | null = activeQuery.isError ? "Could not load geographic data. Clear search or sort and try again." : null;

	const countriesExtracted = useMemo((): ExtractedData => extractFromQuery(countriesQuery.data), [countriesQuery.data]);
	const statesExtracted = useMemo((): ExtractedData => extractFromQuery(statesQuery.data), [statesQuery.data]);
	const citiesExtracted = useMemo((): ExtractedData => extractFromQuery(citiesQuery.data), [citiesQuery.data]);

	const countryItems = useMemo(
		(): GeoRow[] =>
			countriesExtracted.rows.filter(isRecord).map((c) => ({
				id: readNum(c, "id"),
				name: readStr(c, "name"),
				countryCode: readStrN(c, "iso2"),
				flag: c.flag === true,
				emoji: readStrN(c, "emoji"),
			})),
		[countriesExtracted.rows],
	);
	const stateItems = useMemo(
		(): GeoRow[] =>
			statesExtracted.rows.filter(isRecord).map((s) => ({
				id: readNum(s, "id"),
				name: readStr(s, "name"),
				countryCode: readStrN(s, "countryCode"),
				stateCode: readStrN(s, "iso2"),
				latitude: readNumN(s, "latitude"),
				longitude: readNumN(s, "longitude"),
				flag: s.flag === true,
			})),
		[statesExtracted.rows],
	);
	const cityItems = useMemo(
		(): GeoRow[] =>
			citiesExtracted.rows.filter(isRecord).map((c) => ({
				id: readNum(c, "id"),
				name: readStr(c, "name"),
				countryCode: readStrN(c, "countryCode"),
				stateCode: readStrN(c, "stateCode"),
				latitude: readNumN(c, "latitude"),
				longitude: readNumN(c, "longitude"),
				flag: c.flag === true,
			})),
		[citiesExtracted.rows],
	);

	const items = activeTab === "countries" ? countryItems : activeTab === "states" ? stateItems : cityItems;

	const activeExtracted = activeTab === "countries" ? countriesExtracted : activeTab === "states" ? statesExtracted : citiesExtracted;
	const { total } = activeExtracted.meta;

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

	const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setSearch(e.target.value);
	}, []);

	const handleTabChange = useCallback((tab: TabKey) => {
		setActiveTab(tab);
		setPage(1);
		setSearch("");
		setCountryFilter("");
		setSorting([]);
	}, []);

	const handleManualPaginationChange = useCallback((newPage: number, newPageSize: number) => {
		setPage(newPage);
		setPageLimit(newPageSize);
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

	const toolbarContent = useMemo(
		() => (
			<div className="flex items-center gap-2">
				<div className="relative">
					<Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
					<Input placeholder={`Search ${activeTab}...`} value={search} onChange={handleSearchChange} className="w-[250px] pl-8" />
				</div>
				{activeTab === "states" || activeTab === "cities" ? (
					<Input
						placeholder="Country code"
						value={countryFilter}
						onChange={(e) => {
							setCountryFilter(e.target.value);
						}}
						className="w-[120px]"
					/>
				) : null}
				<Button variant="outline" size="sm">
					<Upload className="mr-2 size-4" />
					Import
				</Button>
				<Button variant="outline" size="sm">
					<Download className="mr-2 size-4" />
					Export
				</Button>
			</div>
		),
		[activeTab, search, countryFilter, handleSearchChange],
	);

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
							manual
							totalCount={total}
							pageIndex={page - 1}
							sorting={sorting}
							pageSize={pageLimit}
							pageSizeOptions={PAGE_SIZE_OPTIONS}
							onManualPaginationChange={handleManualPaginationChange}
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
