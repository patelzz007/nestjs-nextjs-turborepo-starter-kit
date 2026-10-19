"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MERCHANT_STORES_LOADING_LABELS, STORE_ROW_LINES, STORE_ROW_SKELETON_ROWS } from "@/components/loading/merchant-page-skeletons";
import { MerchantBorderedRowsSkeleton } from "@/components/loading/merchant-skeleton-parts";
import { ORGANIZATION_ROLE_LABELS } from "@/contexts/organizations/lib/org/role-labels";
import { orgRoutes } from "@/lib/routes";
import { STORES_URL_STATE, toStoresQuery } from "@/contexts/organizations/url-state/stores";
import { toListSearch } from "@workspace/client/lib/api/list-query";
import { readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { trimUrlDraft, useUrlDraft } from "@workspace/client/lib/url-state/use-url-draft";
import { useUrlListPager } from "@workspace/client/lib/url-state/use-url-list-pager";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Card } from "@workspace/ui/components/card";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import { Input } from "@workspace/ui/components/input";
import { ListPager } from "@workspace/ui/components/list-pager";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

/** Wait after the last keystroke before the search is written to the URL (and asked of the API). */
const STORE_SEARCH_DEBOUNCE_MS = 300;
const PAGER_LABELS: UiKitLabelsOverride<"listPager"> = { ariaLabel: "Store pages" };

export interface OrganizationStoresPageViewProps {
	/** The store open in the shell — marked "Current" in the list. */
	readonly orgSlug: string;
}

/**
 * Every store the member belongs to (`GET /orgs/memberships`), searchable and one URL-addressed page at a
 * time — the switcher lists only the first page. Opening a store navigates to its dashboard.
 */
export function OrganizationStoresPageView({ orgSlug }: OrganizationStoresPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const [urlState, updateUrlState] = useUrlState(STORES_URL_STATE);
	const storesQuery = api.organizations.membershipsBootstrap.useQuery(toStoresQuery(urlState), { placeholderData: keepPreviousData });
	const pager = useUrlListPager(urlState, updateUrlState, storesQuery.data?.meta);

	const commitSearch = React.useCallback(
		(value: string): void => {
			// A new search starts on its first page; typing replaces the history entry instead of adding one per keystroke.
			updateUrlState({ search: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const [searchDraft, setSearchDraft] = useUrlDraft({ value: urlState.search ?? "", onCommit: commitSearch, delayMs: STORE_SEARCH_DEBOUNCE_MS, normalize: trimUrlDraft });
	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setSearchDraft(event.target.value);
		},
		[setSearchDraft],
	);

	const stores: readonly OrganizationRewardMembershipResponse[] = storesQuery.data?.data ?? [];
	const total = readPaginatedTotal(storesQuery.data?.meta, stores.length);

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="Your stores" description={`Every store you belong to${storesQuery.isSuccess ? ` (${String(total)})` : ""}. Open one to switch to it.`} />
			<Input type="search" aria-label="Search stores" placeholder="Search by store name" value={searchDraft} onChange={handleSearchChange} className="max-w-sm" />
			{storesQuery.isPending ? (
				<SkeletonRegion labels={MERCHANT_STORES_LOADING_LABELS}>
					<MerchantBorderedRowsSkeleton rows={STORE_ROW_SKELETON_ROWS} lines={STORE_ROW_LINES} trailing="badge" surface="card" />
				</SkeletonRegion>
			) : stores.length === 0 ? (
				<p className="text-sm text-muted-foreground">{urlState.search === undefined ? "You don't belong to any store yet." : "No store matches your search."}</p>
			) : (
				<div className="space-y-3">
					{stores.map((store: OrganizationRewardMembershipResponse): React.JSX.Element => (
						<Card key={store.organizationId} className="gap-0 p-0">
							<Link href={orgRoutes(store.organizationSlug).dashboard} className="flex items-center gap-4 rounded-xl px-5 py-4 transition-colors hover:bg-muted/50">
								<EntityAvatar name={store.displayName} size="sm" className="size-9" />
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-foreground">{store.displayName}</p>
									<p className="text-sm text-muted-foreground">{ORGANIZATION_ROLE_LABELS[store.role]}</p>
								</div>
								{store.organizationSlug === orgSlug ? <Badge variant="secondary">Current</Badge> : null}
							</Link>
						</Card>
					))}
					{pager.isPaged ? (
						<ListPager
							page={pager.page}
							totalPages={pager.totalPages}
							hasPrevious={pager.hasPrevious}
							hasNext={pager.hasNext}
							onPrevious={pager.onPrevious}
							onNext={pager.onNext}
							disabled={storesQuery.isPlaceholderData}
							labels={PAGER_LABELS}
						/>
					) : null}
				</div>
			)}
		</div>
	);
}
