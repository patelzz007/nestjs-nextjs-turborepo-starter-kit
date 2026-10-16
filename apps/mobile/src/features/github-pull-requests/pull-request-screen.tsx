// ============================================
// One pull request (ADR 052)
// ============================================
// Laid out like GitHub's app: `owner/repo #42`, the title, the state pill and
// review decision, "octocat wants to merge 3 commits into main from feature";
// the description (its "edited" opens its history); labels and requested
// reviewers; rows to the commits and the changed files; then the
// conversation on one line down the left, a page at a time; GitHub's merge
// box (review, checks, conflicts) while it is open; and the comment box with
// "Review changes" beside "Comment" (both posted to GitHub). "View on GitHub"
// is a compact pill in the header.

import { useQueryClient } from "@tanstack/react-query";
import type { GithubActor, GithubLabel, GithubPullRequestDetail, GithubPullRequestParams } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import ExternalLinkIcon from "lucide-react-native/icons/external-link";
import { Linking, Text, View } from "react-native";

import { Avatar } from "@workspace/ui-native/components/avatar";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { LineCounts } from "../../components/line-counts";
import { ListRow } from "@workspace/ui-native/components/list-row";
import { Screen } from "../../components/screen";
import { Skeleton, SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import { ErrorState } from "@workspace/ui-native/components/empty";
import { Subheading } from "@workspace/ui-native/components/text";
import { TimelineRailIcon, TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { formatRelativeTime } from "../../lib/time-format";
import { useNow } from "../../lib/use-now";
import { ROUTES } from "../../runtime/routes";
import { changeSummary, formatCount, OPEN_GITHUB_FAILED_MESSAGE } from "../github/labels";
import { EditHistorySheet } from "./edit-history-sheet";
import { needsTokenLink } from "./github-pull-request-access";
import { COMMITS_TITLE, displayStateOf, FILES_CHANGED_TITLE, filesChangedLabel, loginOf, mergeSummary, pullRequestReference, reviewDecisionLabel } from "./labels";
import { LabelChip, PullRequestStatePill } from "./pull-request-badges";
import { MergeBox } from "./merge-box";
import { ApiImageAuthorizationProvider } from "../../lib/api-image-authorization";
import { PullRequestReactionsProvider } from "./comment-reactions";
import { CommentComposer, ReviewSheet } from "./pull-request-composer";
import { LiveUpdatesRow } from "./live-updates-row";
import { usePullRequestLiveUpdates } from "./use-pull-request-live-updates";
import { CommentCard, PullRequestTimeline } from "./pull-request-timeline";
import { refreshPullRequest } from "./refresh";
import { toPullRequestCommitRouteParams, toPullRequestRouteParams } from "./route-params";

/** "commented 2 hours ago" is re-read this often. */
const RELATIVE_TIME_REFRESH_MS = 60_000;

export interface PullRequestScreenProps {
	readonly pullRequest: GithubPullRequestParams;
}

export function PullRequestScreen({ pullRequest }: PullRequestScreenProps): React.JSX.Element {
	const api = useApi();
	const router = useRouter();
	const queryClient = useQueryClient();
	const detail = api.githubPullRequests.detail.useQuery(pullRequest);
	const nowMs = useNow({ intervalMs: RELATIVE_TIME_REFRESH_MS, running: true });
	const [refreshing, setRefreshing] = React.useState(false);
	const refresh = React.useCallback((): void => {
		setRefreshing(true);
		void refreshPullRequest(queryClient, pullRequest).finally((): void => {
			setRefreshing(false);
		});
	}, [pullRequest, queryClient]);
	const retry = React.useCallback((): void => {
		void detail.refetch();
	}, [detail]);
	const linkToken = React.useCallback((): void => {
		router.push(ROUTES.githubAccount);
	}, [router]);

	return (
		<Screen refreshing={refreshing} onRefresh={refresh} testID="pull-request">
			{detail.isPending ? <PullRequestSkeleton /> : null}
			{detail.isError ? (
				needsTokenLink(detail.error) ? (
					<Card title="Link your GitHub token" description={errorMessageOf(detail.error)}>
						<Button label="Link a token" onPress={linkToken} />
					</Card>
				) : (
					<ErrorState message={errorMessageOf(detail.error)} retryLabel="Try again" onRetry={retry} />
				)
			) : null}
			{detail.data === undefined ? null : (
				<ApiImageAuthorizationProvider>
					<PullRequestReactionsProvider pullRequest={pullRequest}>
						<PullRequestView detail={detail.data.data} nowMs={nowMs} />
					</PullRequestReactionsProvider>
				</ApiImageAuthorizationProvider>
			)}
		</Screen>
	);
}

interface PullRequestViewProps {
	readonly detail: GithubPullRequestDetail;
	readonly nowMs: number;
}

function PullRequestView({ detail, nowMs }: PullRequestViewProps): React.JSX.Element {
	const router = useRouter();
	const [editsOf, setEditsOf] = React.useState<string | null>(null);
	const [openFailed, setOpenFailed] = React.useState(false);
	const [reviewing, setReviewing] = React.useState(false);
	const decision = reviewDecisionLabel(detail.reviewDecision);
	const isOpen = detail.state === "open";
	const viewer = useLinkedViewer();
	const params = toPullRequestRouteParams(detail);
	const pullRequestParams = React.useMemo(
		(): GithubPullRequestParams => ({ owner: detail.owner, repository: detail.repository, number: detail.number }),
		[detail.number, detail.owner, detail.repository],
	);
	const liveUpdates = usePullRequestLiveUpdates(pullRequestParams);

	const showEdits = React.useCallback((nodeId: string): void => {
		setEditsOf(nodeId);
	}, []);
	const closeEdits = React.useCallback((): void => {
		setEditsOf(null);
	}, []);
	const openCommits = React.useCallback((): void => {
		router.push({ pathname: ROUTES.pullRequestCommits, params });
	}, [params, router]);
	const openFiles = React.useCallback((): void => {
		router.push({ pathname: ROUTES.pullRequestFiles, params });
	}, [params, router]);
	const openReview = React.useCallback((): void => {
		setReviewing(true);
	}, []);
	const closeReview = React.useCallback((): void => {
		setReviewing(false);
	}, []);
	const openCommit = React.useCallback(
		(sha: string): void => {
			router.push({ pathname: ROUTES.pullRequestCommit, params: toPullRequestCommitRouteParams({ ...pullRequestParams, sha }) });
		},
		[pullRequestParams, router],
	);
	const openOnGithub = React.useCallback((): void => {
		setOpenFailed(false);
		Linking.openURL(detail.htmlUrl).catch((): void => {
			setOpenFailed(true);
		});
	}, [detail.htmlUrl]);

	return (
		<>
			<View className="gap-2.5">
				<Text selectable className="font-sans text-sm text-muted-foreground">
					{pullRequestReference(detail)}
				</Text>
				<Text selectable accessibilityRole="header" className="font-heading text-2xl leading-8 text-foreground">
					{detail.title}
				</Text>
				<View className="flex-row items-center gap-2">
					<View className="flex-1 flex-row flex-wrap items-center gap-2">
						<PullRequestStatePill state={displayStateOf(detail)} testID="pull-request-state" />
						{decision === null ? null : <Text className="font-sans-medium text-sm text-muted-foreground">{decision}</Text>}
					</View>
					<Button
						label="View on GitHub"
						size="sm"
						icon={ExternalLinkIcon}
						accessibilityHint="Opens the pull request in your browser"
						onPress={openOnGithub}
						testID="pull-request-open-github"
					/>
				</View>
				{openFailed ? <Alert tone="error" message={OPEN_GITHUB_FAILED_MESSAGE} /> : null}
				<View className="flex-row items-center gap-2">
					<Avatar name={loginOf(detail.author)} imageUrl={detail.author?.avatarUrl ?? null} size="sm" />
					<Text className="flex-1 font-sans text-sm text-muted-foreground">{mergeSummary(detail)}</Text>
				</View>
			</View>

			<LiveUpdatesRow liveUpdates={liveUpdates} />

			{detail.labels.length === 0 && detail.requestedReviewers.length === 0 ? null : (
				<View className="gap-3">
					{detail.labels.length === 0 ? null : (
						<View className="flex-row flex-wrap gap-1.5">
							{detail.labels.map((label: GithubLabel): React.JSX.Element => (
								<LabelChip key={label.name} label={label} />
							))}
						</View>
					)}
					{detail.requestedReviewers.length === 0 ? null : <RequestedReviewers reviewers={detail.requestedReviewers} />}
				</View>
			)}

			<View className="rounded-xl border border-border bg-card px-4">
				<ListRow
					label={COMMITS_TITLE}
					value={formatCount(detail.commitCount)}
					onPress={openCommits}
					accessibilityHint="Shows the pull request's commits"
					testID="pull-request-commits-row"
				/>
				<View className="h-px bg-border" />
				<ListRow
					label={FILES_CHANGED_TITLE}
					value={filesChangedLabel(detail.changedFiles)}
					detail={<LineCounts additions={formatCount(detail.additions)} deletions={formatCount(detail.deletions)} testID="pull-request-line-counts" />}
					accessibilityLabel={`${FILES_CHANGED_TITLE}, ${filesChangedLabel(detail.changedFiles)}, ${changeSummary(detail.additions, detail.deletions)}`}
					onPress={openFiles}
					accessibilityHint="Shows the changed files and their diffs"
					testID="pull-request-files-row"
				/>
			</View>

			<Subheading>Conversation</Subheading>
			<View>
				<TimelineRailItem node={<Avatar name={loginOf(detail.author)} imageUrl={detail.author?.avatarUrl ?? null} size="md" />}>
					<CommentCard
						comment={{
							id: detail.id,
							author: detail.author,
							body: detail.body,
							images: detail.bodyImages,
							reactions: detail.reactions,
							reactionSubject: { type: "pullRequest" },
							createdAt: detail.createdAt,
							lastEditedAt: detail.bodyLastEditedAt,
							viewerCanUpdate: detail.viewerCanUpdate,
							viewerDidAuthor: detail.viewerDidAuthor,
							htmlUrl: detail.htmlUrl,
						}}
						action={`opened this ${formatRelativeTime(detail.createdAt, nowMs)}`}
						showAvatar={false}
						onShowEdits={showEdits}
					/>
				</TimelineRailItem>
				<Conversation detail={detail} nowMs={nowMs} onShowEdits={showEdits} onOpenCommit={openCommit} />
				{isOpen ? <MergeBox pullRequest={pullRequestParams} reviewDecision={detail.reviewDecision} title={detail.title} headOwner={detail.headOwner ?? detail.owner} /> : null}
				<CommentComposer pullRequest={pullRequestParams} viewer={viewer} onReview={isOpen ? openReview : undefined} />
			</View>

			<EditHistorySheet nodeId={editsOf} nowMs={nowMs} onClose={closeEdits} />
			<ReviewSheet pullRequest={pullRequestParams} visible={reviewing} viewerDidAuthor={detail.viewerDidAuthor} onClose={closeReview} />
		</>
	);
}

function RequestedReviewers({ reviewers }: { readonly reviewers: readonly GithubActor[] }): React.JSX.Element {
	return (
		<View accessible accessibilityLabel={`Review requested from ${reviewers.map(loginOf).join(", ")}`} className="flex-row flex-wrap items-center gap-2">
			<Text className="font-sans text-sm text-muted-foreground">Review requested from</Text>
			{reviewers.map((reviewer: GithubActor): React.JSX.Element => (
				<View key={reviewer.login} className="flex-row items-center gap-1.5">
					<Avatar name={reviewer.login} imageUrl={reviewer.avatarUrl} size="sm" />
					<Text className="font-sans-medium text-sm text-foreground">{reviewer.login}</Text>
				</View>
			))}
		</View>
	);
}

interface ConversationProps {
	readonly detail: GithubPullRequestDetail;
	readonly nowMs: number;
	readonly onShowEdits: (nodeId: string) => void;
	readonly onOpenCommit: (sha: string) => void;
}

/** The first page comes with the pull request; "Load more" reads the next pages under it. */
function Conversation({ detail, nowMs, onShowEdits, onOpenCommit }: ConversationProps): React.JSX.Element {
	const author = detail.author?.login ?? null;
	const [cursors, setCursors] = React.useState<readonly string[]>([]);
	const loadMore = React.useCallback((cursor: string): void => {
		setCursors((current: readonly string[]): readonly string[] => (current.includes(cursor) ? current : [...current, cursor]));
	}, []);
	const firstNext = detail.timeline.nextCursor;
	const loadFirstMore = React.useCallback((): void => {
		if (firstNext !== null) {
			loadMore(firstNext);
		}
	}, [firstNext, loadMore]);
	return (
		<View>
			<PullRequestTimeline items={detail.timeline.items} nowMs={nowMs} pullRequestAuthor={author} onShowEdits={onShowEdits} onOpenCommit={onOpenCommit} />
			{cursors.map((cursor: string, index: number): React.JSX.Element => (
				<TimelinePage
					key={cursor}
					pullRequest={detail}
					pullRequestAuthor={author}
					cursor={cursor}
					isLast={index === cursors.length - 1}
					nowMs={nowMs}
					onShowEdits={onShowEdits}
					onOpenCommit={onOpenCommit}
					onLoadMore={loadMore}
				/>
			))}
			{cursors.length === 0 && firstNext !== null ? <LoadMoreEntry onPress={loadFirstMore} /> : null}
		</View>
	);
}

interface TimelinePageProps {
	readonly pullRequest: GithubPullRequestParams;
	readonly pullRequestAuthor: string | null;
	readonly onOpenCommit: (sha: string) => void;
	readonly cursor: string;
	readonly isLast: boolean;
	readonly nowMs: number;
	readonly onShowEdits: (nodeId: string) => void;
	readonly onLoadMore: (cursor: string) => void;
}

function TimelinePage({ pullRequest, pullRequestAuthor, cursor, isLast, nowMs, onShowEdits, onOpenCommit, onLoadMore }: TimelinePageProps): React.JSX.Element {
	const api = useApi();
	const page = api.githubPullRequests.timeline.useQuery({ owner: pullRequest.owner, repository: pullRequest.repository, number: pullRequest.number, cursor });
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
			<TimelineRailItem node={<TimelineRailIcon icon={EllipsisIcon} />} compact>
				<SkeletonText size="sm" widthClassName="w-1/2" />
			</TimelineRailItem>
		);
	}
	if (page.isError) {
		return (
			<TimelineRailItem node={<TimelineRailIcon icon={EllipsisIcon} />}>
				<ErrorState message={errorMessageOf(page.error)} retryLabel="Try again" onRetry={retry} />
			</TimelineRailItem>
		);
	}
	return (
		<View>
			<PullRequestTimeline items={page.data.data.items} nowMs={nowMs} pullRequestAuthor={pullRequestAuthor} onShowEdits={onShowEdits} onOpenCommit={onOpenCommit} />
			{isLast && nextCursor !== null ? <LoadMoreEntry onPress={loadMore} /> : null}
		</View>
	);
}

/** "Load more" on the conversation's line, where the hidden entries would be. */
function LoadMoreEntry({ onPress }: { readonly onPress: () => void }): React.JSX.Element {
	return (
		<TimelineRailItem node={<TimelineRailIcon icon={EllipsisIcon} />} compact>
			<View className="self-start">
				<Button
					label="Load more"
					variant="secondary"
					size="sm"
					onPress={onPress}
					accessibilityHint="Shows older entries of the conversation"
					testID="pull-request-timeline-more"
				/>
			</View>
		</TimelineRailItem>
	);
}

/** The linked GitHub account, for the composer's avatar; `null` until known. */
function useLinkedViewer(): GithubActor | null {
	const api = useApi();
	const account = api.githubPullRequests.account.useQuery(undefined).data?.data;
	return account?.status === "linked" ? { login: account.login, avatarUrl: account.avatarUrl } : null;
}

/** The pull request's shape while it loads: the header, the description and the rows. */
function PullRequestSkeleton(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading the pull request" testID="pull-request-skeleton" className="gap-5">
			<View className="gap-2.5">
				<SkeletonText size="sm" widthClassName="w-1/3" />
				<SkeletonText size="2xl" widthClassName="w-5/6" />
				<Skeleton className="h-7 w-24 rounded-full" />
			</View>
			<Skeleton className="h-32 w-full rounded-xl" />
			<Skeleton className="h-28 w-full rounded-xl" />
		</SkeletonGroup>
	);
}
