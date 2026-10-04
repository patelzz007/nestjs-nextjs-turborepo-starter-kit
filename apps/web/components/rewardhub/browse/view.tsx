"use client";

import { RewardHubCatalog } from "@/components/rewardhub/browse/catalog";
import { RewardHubFilters, type RewardHubCityOption } from "@/components/rewardhub/browse/filters";
import { initialDataOption, readPaginatedHasNext, readPaginatedNextCursor } from "@workspace/client/lib/api/envelope";
import { toListSearch } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE, listPagePatch } from "@workspace/client/lib/url-state/list-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { WebEmptyState } from "@/components/web-ui/empty-state";
import { useAuth } from "@workspace/client/lib/auth";
import { PILOT_CITY_LABELS, PilotCitySchema, RewardCategorySchema, type Envelope, type PilotCity, type RewardCategory, type RewardResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { AlertTriangle, Gift, MapPin, Search, Sparkles } from "lucide-react";
import * as React from "react";
import { LANDING_SECTION_IDS, ROUTE_PREFIXES } from "@/lib/routes";
import { REWARDS_BROWSE_URL_STATE, toRewardsBrowseListQuery } from "@/lib/url-state/rewards-browse";
import { useSubmittedUrlDraft } from "@workspace/client/lib/url-state/use-submitted-url-draft";

/** Every reward category, in the contract's order — the chips and the "Categories" count come from the shared enum. */
const CATEGORIES: readonly RewardCategory[] = RewardCategorySchema.options;

/** Every pilot city with its display name — the chips, the "Cities" count and the header copy come from the shared enum. */
const CITY_OPTIONS: readonly RewardHubCityOption[] = PilotCitySchema.options.map((city: PilotCity): RewardHubCityOption => ({ value: city, label: PILOT_CITY_LABELS[city] }));

/** The language of this view's copy — the city list is joined with that language's conjunction. */
const COPY_LOCALE = "en";

const CITY_NAMES: readonly string[] = CITY_OPTIONS.map((option: RewardHubCityOption): string => option.label);

/** "Kuala Lumpur and Melaka" — the pilot cities as running text. */
const CITY_NAMES_TEXT: string = new Intl.ListFormat(COPY_LOCALE, { style: "long", type: "conjunction" }).format(CITY_NAMES);

/** "Kuala Lumpur & Melaka pilots" — the pilot cities as a compact hint. */
const CITY_NAMES_HINT = `${new Intl.ListFormat(COPY_LOCALE, { style: "short", type: "conjunction" }).format(CITY_NAMES)} pilots`;

export interface RewardHubBrowseViewProps {
	/** The catalog page the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<Envelope<RewardResponse[]>> | undefined;
	readonly variant?: "landing" | "dashboard";
	readonly detailPathPrefix?: string;
}

/**
 * Consumer Reward Hub browse experience — filters, summary, and grid/list catalog.
 * Search, city, category and page live in the URL (lib/url-state/rewards-browse):
 * shareable, refresh-safe and back/forward-aware. The only local state is the
 * search box's unsubmitted text; the grid/list layout is a `ui-preferences` preference.
 */
export function RewardHubBrowseView({ initialPage, variant = "dashboard", detailPathPrefix = ROUTE_PREFIXES.rewardHubRewards }: RewardHubBrowseViewProps): React.JSX.Element {
	const { api } = useAuth();
	const [urlState, updateUrlState] = useUrlState(REWARDS_BROWSE_URL_STATE);
	const [searchDraft, setSearchDraft] = useSubmittedUrlDraft(urlState.search);

	const stateKey: string = REWARDS_BROWSE_URL_STATE.serialize(urlState);
	const prefetchedPage = prefetchedDataFor(initialPage, stateKey);
	const rewardsQuery = api.rewards.list.useQuery(toRewardsBrowseListQuery(urlState), initialDataOption(prefetchedPage));

	const rewards = rewardsQuery.data?.data ?? [];
	const hasNext = readPaginatedHasNext(rewardsQuery.data?.meta);
	const nextCursor = readPaginatedNextCursor(rewardsQuery.data?.meta);
	const hasPrevious = urlState.page > LIST_FIRST_PAGE;

	// Every discrete change pushes a history entry, so Back undoes it; a new filter starts at page 1.
	const handleSearchSubmit = React.useCallback((): void => {
		updateUrlState({ search: toListSearch(searchDraft), page: LIST_FIRST_PAGE, cursor: undefined });
	}, [searchDraft, updateUrlState]);

	const handleCityChange = React.useCallback(
		(nextCity: PilotCity | undefined): void => {
			updateUrlState({ city: nextCity, page: LIST_FIRST_PAGE, cursor: undefined });
		},
		[updateUrlState],
	);

	const handleCategoryChange = React.useCallback(
		(nextCategory: RewardCategory | undefined): void => {
			updateUrlState({ category: nextCategory, page: LIST_FIRST_PAGE, cursor: undefined });
		},
		[updateUrlState],
	);

	const handleClearFilters = React.useCallback((): void => {
		updateUrlState({ search: undefined, city: undefined, category: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	const handleNext = React.useCallback((): void => {
		updateUrlState(listPagePatch(urlState, urlState.page + 1, nextCursor));
	}, [nextCursor, updateUrlState, urlState]);

	const handlePrevious = React.useCallback((): void => {
		if (urlState.page <= LIST_FIRST_PAGE) {
			return;
		}
		updateUrlState(listPagePatch(urlState, urlState.page - 1, null));
	}, [updateUrlState, urlState]);

	const hasActiveFilters = urlState.search !== undefined || urlState.city !== undefined || urlState.category !== undefined;
	const isLoading = rewardsQuery.isLoading;
	// A failed fetch with nothing to show is an error, never "everything is sold out".
	const showError = rewardsQuery.isError && rewardsQuery.data === undefined;
	const showEmpty = !isLoading && !showError && rewards.length === 0;

	const handleRetry = React.useCallback((): void => {
		void rewardsQuery.refetch();
	}, [rewardsQuery]);

	const summaryItems = React.useMemo(
		() => [
			{
				label: "Showing",
				value: String(rewards.length),
				hint: "Offers on this page",
				icon: <Gift className="size-4" aria-hidden="true" />,
			},
			{
				label: "Cities",
				value: String(CITY_OPTIONS.length),
				hint: CITY_NAMES_HINT,
				icon: <MapPin className="size-4" aria-hidden="true" />,
			},
			{
				label: "Categories",
				value: String(CATEGORIES.length),
				hint: "Food, retail & more",
				icon: <Sparkles className="size-4" aria-hidden="true" />,
			},
		],
		[rewards.length],
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
							Claim discounts and free items from participating merchants across {CITY_NAMES_TEXT}.
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
					<h2 id={LANDING_SECTION_IDS.rewards} className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
						Live offers near you
					</h2>
					<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Filter by city or category. Sign in from the header when you&apos;re ready to claim.</p>
				</div>
			)}

			<RewardHubFilters
				searchDraft={searchDraft}
				city={urlState.city}
				category={urlState.category}
				cities={CITY_OPTIONS}
				categories={CATEGORIES}
				onSearchDraftChange={setSearchDraft}
				onSearchSubmit={handleSearchSubmit}
				onCityChange={handleCityChange}
				onCategoryChange={handleCategoryChange}
				onClearFilters={handleClearFilters}
				hasActiveFilters={hasActiveFilters}
			/>

			{showError ? (
				<WebEmptyState
					title="Couldn't load rewards"
					description="Something went wrong while loading the catalog. Check your connection and try again."
					icon={<AlertTriangle className="size-5" aria-hidden="true" />}
					action={
						<Button type="button" onClick={handleRetry}>
							Try again
						</Button>
					}
				/>
			) : showEmpty ? (
				<WebEmptyState
					title="No claimable rewards"
					description="Everything matching your filters is sold out or expired. Try another city or category."
					icon={<Search className="size-5" aria-hidden="true" />}
				/>
			) : (
				<RewardHubCatalog
					rewards={rewards}
					isLoading={isLoading}
					hasNext={hasNext}
					hasPrevious={hasPrevious}
					onNext={handleNext}
					onPrevious={handlePrevious}
					detailPathPrefix={detailPathPrefix}
				/>
			)}
		</div>
	);
}
