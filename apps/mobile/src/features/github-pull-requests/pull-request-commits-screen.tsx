// ============================================
// A pull request's commits (ADR 052)
// ============================================
// Oldest first, as GitHub lists them: the headline, who committed it and when,
// lines added and deleted. Pressing a commit opens its own screen with every
// changed file and its diff, read with the admin's own token.

import { useQueryClient } from "@tanstack/react-query";
import type { GithubCommit, GithubPullRequestParams } from "@workspace/shared";
import * as React from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Button } from "../../components/button";
import { ChangeRow } from "../../components/change-row";
import { Screen } from "../../components/screen";
import { SkeletonGroup, SkeletonText } from "../../components/skeleton";
import { EmptyState, ErrorState } from "../../components/states";
import { MutedText } from "../../components/text";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { useNow } from "../../lib/use-now";
import { ROUTES } from "../../runtime/routes";
import { changeSummary, commitAuthorName, commitMeta, countOf, formatCount } from "../github/labels";
import { refreshPullRequest } from "./refresh";
import { toPullRequestCommitRouteParams } from "./route-params";

/** "committed 2 hours ago" is re-read this often. */
const RELATIVE_TIME_REFRESH_MS = 60_000;

export interface PullRequestCommitsScreenProps {
	readonly pullRequest: GithubPullRequestParams;
}

export function PullRequestCommitsScreen({ pullRequest }: PullRequestCommitsScreenProps): React.JSX.Element {
	const queryClient = useQueryClient();
	const nowMs = useNow({ intervalMs: RELATIVE_TIME_REFRESH_MS, running: true });
	const [cursors, setCursors] = React.useState<readonly (string | undefined)[]>([undefined]);
	const router = useRouter();
	const [refreshing, setRefreshing] = React.useState(false);
	const refresh = React.useCallback((): void => {
		setRefreshing(true);
		setCursors([undefined]);
		void refreshPullRequest(queryClient, pullRequest).finally((): void => {
			setRefreshing(false);
		});
	}, [pullRequest, queryClient]);
	const loadMore = React.useCallback((cursor: string): void => {
		setCursors((current: readonly (string | undefined)[]): readonly (string | undefined)[] => (current.includes(cursor) ? current : [...current, cursor]));
	}, []);
	const open = React.useCallback(
		(commit: GithubCommit): void => {
			router.push({ pathname: ROUTES.pullRequestCommit, params: toPullRequestCommitRouteParams({ ...pullRequest, sha: commit.sha }) });
		},
		[pullRequest, router],
	);
	return (
		<Screen refreshing={refreshing} onRefresh={refresh} testID="pull-request-commits">
			<View>
				{cursors.map((cursor: string | undefined, index: number): React.JSX.Element => (
					<CommitsPage
						key={cursor ?? "first"}
						pullRequest={pullRequest}
						cursor={cursor}
						isLast={index === cursors.length - 1}
						nowMs={nowMs}
						onOpen={open}
						onLoadMore={loadMore}
					/>
				))}
			</View>
		</Screen>
	);
}

interface CommitsPageProps {
	readonly pullRequest: GithubPullRequestParams;
	readonly cursor: string | undefined;
	readonly isLast: boolean;
	readonly nowMs: number;
	readonly onOpen: (commit: GithubCommit) => void;
	readonly onLoadMore: (cursor: string) => void;
}

function CommitsPage({ pullRequest, cursor, isLast, nowMs, onOpen, onLoadMore }: CommitsPageProps): React.JSX.Element {
	const api = useApi();
	const page = api.githubPullRequests.commits.useQuery({ ...pullRequest, ...(cursor === undefined ? {} : { cursor }) });
	const retry = React.useCallback((): void => {
		void page.refetch();
	}, [page]);
	const nextCursor = page.data?.data.nextCursor ?? null;
	const loadMore = React.useCallback((): void => {
		if (nextCursor !== null) {
			onLoadMore(nextCursor);
		}
	}, [nextCursor, onLoadMore]);
	if (page.isPending) {
		return (
			<SkeletonGroup accessibilityLabel="Loading the commits" className="gap-4">
				<SkeletonText size="base" widthClassName="w-3/4" />
				<SkeletonText size="base" widthClassName="w-2/3" />
			</SkeletonGroup>
		);
	}
	if (page.isError) {
		return <ErrorState message={errorMessageOf(page.error)} retryLabel="Try again" onRetry={retry} />;
	}
	const { items, totalCount } = page.data.data;
	if (cursor === undefined && items.length === 0) {
		return <EmptyState message="This pull request has no commits." />;
	}
	return (
		<View>
			{cursor === undefined ? <MutedText className="pb-1">{countOf(totalCount, "commit", "commits")}</MutedText> : null}
			{items.map((commit: GithubCommit): React.JSX.Element => (
				<CommitRow key={commit.sha} commit={commit} nowMs={nowMs} onOpen={onOpen} />
			))}
			{isLast && nextCursor !== null ? (
				<View className="pt-4">
					<Button label="Load more" variant="secondary" onPress={loadMore} />
				</View>
			) : null}
		</View>
	);
}

const CommitRow = React.memo(function CommitRow({
	commit,
	nowMs,
	onOpen,
}: {
	readonly commit: GithubCommit;
	readonly nowMs: number;
	readonly onOpen: (commit: GithubCommit) => void;
}): React.JSX.Element {
	const open = React.useCallback((): void => {
		onOpen(commit);
	}, [commit, onOpen]);
	return (
		<ChangeRow
			title={commit.headline}
			meta={commitMeta(commit, nowMs)}
			additions={formatCount(commit.additions)}
			deletions={formatCount(commit.deletions)}
			changeSummary={changeSummary(commit.additions, commit.deletions)}
			leading={<Avatar name={commitAuthorName(commit)} imageUrl={commit.author.avatarUrl} size="sm" />}
			onPress={open}
			accessibilityHint="Shows the commit's changes"
			testID={`pull-request-commit-${commit.shortSha}`}
		/>
	);
});
