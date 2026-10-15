// ============================================
// Pull requests — the list (ADR 052)
// ============================================
// GitHub's pull-request inbox: a state chip (open / closed) and a filter chip
// (your repositories, created by you, review requests, assigned, mentions),
// then the pull requests, most recently updated first. Each page is its own
// cached read (its cursor is part of the key); "Load more" adds the next page
// under it. Without a working token the screen offers to link one.

import { useQueryClient } from "@tanstack/react-query";
import {
	GithubPullRequestFilterSchema,
	GithubPullRequestStateFilterSchema,
	type GithubPullRequestFilter,
	type GithubPullRequestStateFilter,
	type GithubPullRequestSummary,
} from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { FilterChip, type FilterChipOption } from "../../components/filter-chip";
import { Screen } from "../../components/screen";
import { Skeleton, SkeletonGroup, SkeletonText } from "../../components/skeleton";
import { EmptyState, ErrorState } from "../../components/states";
import { MutedText } from "../../components/text";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { useNow } from "../../lib/use-now";
import { ROUTES } from "../../runtime/routes";
import { needsTokenLink } from "./github-pull-request-access";
import { NO_PULL_REQUESTS_MESSAGE, PULL_REQUEST_FILTER_LABELS, PULL_REQUEST_STATE_FILTER_LABELS } from "./labels";
import { PullRequestRow } from "./pull-request-row";
import { refreshAllPullRequests } from "./refresh";
import { toPullRequestRouteParams } from "./route-params";

/** "opened 2 days ago" is re-read this often. */
const RELATIVE_TIME_REFRESH_MS = 60_000;

const STATE_OPTIONS: readonly FilterChipOption<GithubPullRequestStateFilter>[] = GithubPullRequestStateFilterSchema.options.map(
	(value: GithubPullRequestStateFilter): FilterChipOption<GithubPullRequestStateFilter> => ({ value, label: PULL_REQUEST_STATE_FILTER_LABELS[value] }),
);

const FILTER_OPTIONS: readonly FilterChipOption<GithubPullRequestFilter>[] = GithubPullRequestFilterSchema.options.map(
	(value: GithubPullRequestFilter): FilterChipOption<GithubPullRequestFilter> => ({ value, label: PULL_REQUEST_FILTER_LABELS[value] }),
);

/** The first page has no cursor. */
const FIRST_PAGE: readonly (string | undefined)[] = [undefined];

export function PullRequestListScreen(): React.JSX.Element {
	const queryClient = useQueryClient();
	const nowMs = useNow({ intervalMs: RELATIVE_TIME_REFRESH_MS, running: true });
	const [state, setState] = React.useState<GithubPullRequestStateFilter>("open");
	const [filter, setFilter] = React.useState<GithubPullRequestFilter>("yours");
	// The cursors of the pages shown, in order; a filter change starts over at the first page.
	const [cursors, setCursors] = React.useState<readonly (string | undefined)[]>(FIRST_PAGE);
	const [refreshing, setRefreshing] = React.useState(false);

	const chooseState = React.useCallback((next: GithubPullRequestStateFilter): void => {
		setState(next);
		setCursors(FIRST_PAGE);
	}, []);
	const chooseFilter = React.useCallback((next: GithubPullRequestFilter): void => {
		setFilter(next);
		setCursors(FIRST_PAGE);
	}, []);
	const loadMore = React.useCallback((cursor: string): void => {
		setCursors((current: readonly (string | undefined)[]): readonly (string | undefined)[] => (current.includes(cursor) ? current : [...current, cursor]));
	}, []);
	const refresh = React.useCallback((): void => {
		setRefreshing(true);
		setCursors(FIRST_PAGE);
		void refreshAllPullRequests(queryClient).finally((): void => {
			setRefreshing(false);
		});
	}, [queryClient]);

	return (
		<Screen refreshing={refreshing} onRefresh={refresh} testID="pull-requests">
			<View className="flex-row flex-wrap gap-2">
				<FilterChip title="State" options={STATE_OPTIONS} value={state} onChange={chooseState} testID="pull-requests-state" />
				<FilterChip title="Filter" options={FILTER_OPTIONS} value={filter} onChange={chooseFilter} testID="pull-requests-filter" />
			</View>
			<View>
				{cursors.map((cursor: string | undefined, index: number): React.JSX.Element => (
					<PullRequestPage key={cursor ?? "first"} filter={filter} state={state} cursor={cursor} isLast={index === cursors.length - 1} nowMs={nowMs} onLoadMore={loadMore} />
				))}
			</View>
		</Screen>
	);
}

interface PullRequestPageProps {
	readonly filter: GithubPullRequestFilter;
	readonly state: GithubPullRequestStateFilter;
	readonly cursor: string | undefined;
	/** Only the last page shown offers "Load more". */
	readonly isLast: boolean;
	readonly nowMs: number;
	readonly onLoadMore: (cursor: string) => void;
}

function PullRequestPage({ filter, state, cursor, isLast, nowMs, onLoadMore }: PullRequestPageProps): React.JSX.Element {
	const api = useApi();
	const router = useRouter();
	const page = api.githubPullRequests.list.useQuery({ filter, state, ...(cursor === undefined ? {} : { cursor }) });
	const retry = React.useCallback((): void => {
		void page.refetch();
	}, [page]);
	const open = React.useCallback(
		(pullRequest: GithubPullRequestSummary): void => {
			router.push({ pathname: ROUTES.pullRequest, params: toPullRequestRouteParams(pullRequest) });
		},
		[router],
	);
	const linkToken = React.useCallback((): void => {
		router.push(ROUTES.githubAccount);
	}, [router]);
	const nextCursor = page.data?.data.nextCursor ?? null;
	const loadMore = React.useCallback((): void => {
		if (nextCursor !== null) {
			onLoadMore(nextCursor);
		}
	}, [nextCursor, onLoadMore]);

	if (page.isPending) {
		return <ListSkeleton />;
	}
	if (page.isError) {
		return needsTokenLink(page.error) ? (
			<Card title="Link your GitHub token" description={errorMessageOf(page.error)}>
				<Button label="Link a token" onPress={linkToken} testID="pull-requests-link-token" />
			</Card>
		) : (
			<ErrorState message={errorMessageOf(page.error)} retryLabel="Try again" onRetry={retry} />
		);
	}
	const { items, totalCount } = page.data.data;
	if (cursor === undefined && items.length === 0) {
		return <EmptyState message={NO_PULL_REQUESTS_MESSAGE} />;
	}
	return (
		<View>
			{cursor === undefined ? <MutedText className="pb-1">{`${String(totalCount)} ${totalCount === 1 ? "pull request" : "pull requests"}`}</MutedText> : null}
			{items.map((pullRequest: GithubPullRequestSummary): React.JSX.Element => (
				<PullRequestRow key={`${pullRequest.owner}/${pullRequest.repository}#${String(pullRequest.number)}`} pullRequest={pullRequest} nowMs={nowMs} onOpen={open} />
			))}
			{isLast && nextCursor !== null ? (
				<View className="pt-4">
					<Button label="Load more" variant="secondary" onPress={loadMore} testID="pull-requests-load-more" />
				</View>
			) : null}
		</View>
	);
}

/** The list's shape while it loads: three rows. */
function ListSkeleton(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading pull requests" testID="pull-requests-skeleton" className="gap-5 pt-2">
			{["a", "b", "c"].map((key: string): React.JSX.Element => (
				<View key={key} className="flex-row gap-3">
					<Skeleton className="size-5 rounded-full" />
					<View className="flex-1 gap-2">
						<SkeletonText size="sm" widthClassName="w-1/3" />
						<SkeletonText size="base" widthClassName="w-5/6" />
						<SkeletonText size="sm" widthClassName="w-1/2" />
					</View>
				</View>
			))}
		</SkeletonGroup>
	);
}
