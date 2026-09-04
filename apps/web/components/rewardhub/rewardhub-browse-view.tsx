"use client";

import { RewardHubCatalog } from "@/components/rewardhub/rewardhub-catalog";
import { RewardHubFilters } from "@/components/rewardhub/rewardhub-filters";
import { stubPaginatedMeta } from "@/lib/api-envelope";
import { WebEmptyState } from "@/components/web-ui/empty-state";
import { useAuth } from "@workspace/client/lib/auth";
import { ApiPaginatedMetaSchema, type ApiPaginatedMeta, type PilotCity, type RewardCategory, type RewardResponse } from "@workspace/shared";
import { Gift, MapPin, Search, Sparkles } from "lucide-react";
import * as React from "react";

const CATEGORIES: readonly RewardCategory[] = ["cafe", "restaurant", "retail", "wellness", "entertainment", "food", "beverage"];

export interface RewardHubBrowseViewProps {
	readonly initialRewards?: readonly RewardResponse[];
	readonly initialTotal?: number;
	readonly initialHasNext?: boolean;
	readonly initialHasPrevious?: boolean;
	readonly initialListMeta?: ApiPaginatedMeta;
	readonly variant?: "landing" | "dashboard";
	readonly detailPathPrefix?: string;
}

/** Consumer Reward Hub browse experience — filters, summary, and grid/list catalog. */
export function RewardHubBrowseView({
	initialRewards,
	initialTotal,
	initialHasNext,
	initialHasPrevious,
	initialListMeta,
	variant = "dashboard",
	detailPathPrefix = "/rewardhub",
}: RewardHubBrowseViewProps): React.JSX.Element {
	const { api } = useAuth();
	const [page, setPage] = React.useState<number>(1);
	const [search, setSearch] = React.useState<string>("");
	const [searchDraft, setSearchDraft] = React.useState<string>("");
	const [city, setCity] = React.useState<PilotCity | "ALL">("ALL");
	const [category, setCategory] = React.useState<RewardCategory | "ALL">("ALL");

	const isDefaultQuery = page === 1 && search.length === 0 && city === "ALL" && category === "ALL";

	const initialQueryData = React.useMemo(
		() =>
			initialRewards !== undefined && isDefaultQuery
				? {
						success: true as const,
						data: [...initialRewards],
						meta: initialListMeta ?? stubPaginatedMeta(initialTotal ?? initialRewards.length, 1, 12),
					}
				: undefined,
		[initialListMeta, initialRewards, initialTotal, isDefaultQuery],
	);

	const rewardsQuery = api.rewards.list.useQuery(
		{
			page,
			limit: 12,
			...(search.length > 0 ? { search } : {}),
			...(city !== "ALL" ? { city } : {}),
			...(category !== "ALL" ? { category } : {}),
		},
		{
			initialData: initialQueryData,
		},
	);

	const rewards = rewardsQuery.data?.data ?? [];
	const metaParsed = ApiPaginatedMetaSchema.safeParse(rewardsQuery.data?.meta);
	const total = isDefaultQuery && initialTotal !== undefined ? initialTotal : metaParsed.success && metaParsed.data.total !== null ? metaParsed.data.total : rewards.length;
	const hasNext = isDefaultQuery && initialHasNext !== undefined ? initialHasNext : metaParsed.success ? metaParsed.data.hasNext === true : false;
	const hasPrevious = isDefaultQuery && initialHasPrevious !== undefined ? initialHasPrevious : metaParsed.success ? metaParsed.data.hasPrevious === true : page > 1;

	const handleSearchSubmit = React.useCallback((): void => {
		setSearch(searchDraft.trim());
		setPage(1);
	}, [searchDraft]);

	const handleCityChange = React.useCallback((nextCity: PilotCity | "ALL"): void => {
		setCity(nextCity);
		setPage(1);
	}, []);

	const handleCategoryChange = React.useCallback((nextCategory: RewardCategory | "ALL"): void => {
		setCategory(nextCategory);
		setPage(1);
	}, []);

	const handleClearFilters = React.useCallback((): void => {
		setSearch("");
		setSearchDraft("");
		setCity("ALL");
		setCategory("ALL");
		setPage(1);
	}, []);

	const handlePageChange = React.useCallback((nextPage: number): void => {
		setPage(nextPage);
	}, []);

	const hasActiveFilters = search.length > 0 || city !== "ALL" || category !== "ALL";
	const isLoading = rewardsQuery.isLoading && !(isDefaultQuery && initialRewards !== undefined);
	const showEmpty = !isLoading && rewards.length === 0;

	const summaryItems = React.useMemo(
		() => [
			{
				label: "In stock",
				value: total.toLocaleString(),
				hint: "Claimable offers",
				icon: <Gift className="size-4" aria-hidden="true" />,
			},
			{
				label: "Cities",
				value: "2",
				hint: "KL & Melaka pilots",
				icon: <MapPin className="size-4" aria-hidden="true" />,
			},
			{
				label: "Categories",
				value: String(CATEGORIES.length),
				hint: "Food, retail & more",
				icon: <Sparkles className="size-4" aria-hidden="true" />,
			},
		],
		[total],
	);

	const isLanding = variant === "landing";

	return (
		<div className="space-y-8">
			{!isLanding ? (
				<header className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
					<div className="border-b border-border/80 bg-secondary/40 px-5 py-6 sm:px-8 sm:py-8">
						<p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Reward Hub</p>
						<h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Discover local rewards</h1>
						<p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
							Claim discounts and free items from participating merchants across Kuala Lumpur and Melaka.
						</p>
					</div>
					<div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
						{summaryItems.map((item) => (
							<div key={item.label} className="flex items-center gap-3 rounded-xl border border-border/80 bg-background px-4 py-3">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">{item.icon}</div>
								<div className="min-w-0">
									<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{item.label}</p>
									<p className="text-xl font-semibold tracking-tight text-foreground tabular-nums">{item.value}</p>
									<p className="truncate text-xs text-muted-foreground">{item.hint}</p>
								</div>
							</div>
						))}
					</div>
				</header>
			) : (
				<div className="space-y-2">
					<h2 id="rewards" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
						Live offers near you
					</h2>
					<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Filter by city or category. Sign in from the header when you&apos;re ready to claim.</p>
				</div>
			)}

			<RewardHubFilters
				searchDraft={searchDraft}
				city={city}
				category={category}
				categories={CATEGORIES}
				onSearchDraftChange={setSearchDraft}
				onSearchSubmit={handleSearchSubmit}
				onCityChange={handleCityChange}
				onCategoryChange={handleCategoryChange}
				onClearFilters={handleClearFilters}
				hasActiveFilters={hasActiveFilters}
			/>

			{showEmpty ? (
				<WebEmptyState
					title="No claimable rewards"
					description="Everything matching your filters is sold out or expired. Try another city or category."
					icon={<Search className="size-5" aria-hidden="true" />}
				/>
			) : (
				<RewardHubCatalog
					rewards={rewards}
					isLoading={isLoading}
					total={total}
					page={page}
					hasNext={hasNext}
					hasPrevious={hasPrevious}
					onPageChange={handlePageChange}
					detailPathPrefix={detailPathPrefix}
				/>
			)}
		</div>
	);
}
