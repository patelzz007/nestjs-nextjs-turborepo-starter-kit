// ============================================
// A pull request's changed files (ADR 052)
// ============================================
// Like GitHub's app: each file with its status, path and diffstat; open it to
// see its diff, with the line-comment threads under the lines they are on
// (outdated ones above the diff). Files come 100 a page; short diffs open
// expanded. Threads come from one read for the whole pull request.

import { useQueryClient } from "@tanstack/react-query";
import type { GithubCommitFile, GithubPullRequestParams, GithubReviewComment, GithubReviewThread } from "@workspace/shared";
import * as React from "react";
import { Text, View } from "react-native";

import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import { ChangedFile } from "../../components/changed-file";
import { DiffView } from "../../components/diff-view";
import { Screen } from "../../components/screen";
import { Skeleton, SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import { EmptyState, ErrorState } from "@workspace/ui-native/components/empty";
import { MutedText } from "@workspace/ui-native/components/text";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { useNow } from "../../lib/use-now";
import { diffStatBlocks, initiallyExpandedPaths, parsePatch } from "../github/diff";
import { FILE_STATUS_ICONS } from "../github/file-status-icons";
import { changeSummary, fileStatusLabel, formatCount, missingDiffMessage } from "../github/labels";
import { ApiImageAuthorizationProvider } from "../../lib/api-image-authorization";
import { PullRequestReactionsProvider } from "./comment-reactions";
import { EditHistorySheet } from "./edit-history-sheet";
import { threadDiff, type DiffSegment } from "./diff-threads";
import { CommentCard } from "./pull-request-timeline";
import { refreshPullRequest } from "./refresh";
import { commentedLabel } from "./labels";

/** "commented 2 hours ago" is re-read this often. */
const RELATIVE_TIME_REFRESH_MS = 60_000;
const FIRST_FILES_PAGE = 1;
export const MORE_THREADS_ON_GITHUB = "This pull request has more line comments than shown. The rest are on GitHub.";

export interface PullRequestFilesScreenProps {
	readonly pullRequest: GithubPullRequestParams;
}

export function PullRequestFilesScreen({ pullRequest }: PullRequestFilesScreenProps): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const threads = api.githubPullRequests.reviewThreads.useQuery(pullRequest);
	const nowMs = useNow({ intervalMs: RELATIVE_TIME_REFRESH_MS, running: true });
	const [pages, setPages] = React.useState<readonly number[]>([FIRST_FILES_PAGE]);
	const [editsOf, setEditsOf] = React.useState<string | null>(null);
	const [refreshing, setRefreshing] = React.useState(false);
	const refresh = React.useCallback((): void => {
		setRefreshing(true);
		setPages([FIRST_FILES_PAGE]);
		void refreshPullRequest(queryClient, pullRequest).finally((): void => {
			setRefreshing(false);
		});
	}, [pullRequest, queryClient]);
	const loadPage = React.useCallback((page: number): void => {
		setPages((current: readonly number[]): readonly number[] => (current.includes(page) ? current : [...current, page]));
	}, []);
	const showEdits = React.useCallback((nodeId: string): void => {
		setEditsOf(nodeId);
	}, []);
	const closeEdits = React.useCallback((): void => {
		setEditsOf(null);
	}, []);
	const threadList = threads.data?.data;
	const threadsByPath = React.useMemo((): ReadonlyMap<string, readonly GithubReviewThread[]> => {
		const byPath = new Map<string, GithubReviewThread[]>();
		for (const thread of threadList?.threads ?? []) {
			byPath.set(thread.path, [...(byPath.get(thread.path) ?? []), thread]);
		}
		return byPath;
	}, [threadList]);

	return (
		<Screen refreshing={refreshing} onRefresh={refresh} testID="pull-request-files">
			{threads.isError ? <Alert tone="error" message={errorMessageOf(threads.error)} /> : null}
			{threadList?.truncated === true ? <Alert tone="info" message={MORE_THREADS_ON_GITHUB} /> : null}
			<ApiImageAuthorizationProvider>
				<PullRequestReactionsProvider pullRequest={pullRequest}>
					{pages.map((page: number, index: number): React.JSX.Element => (
						<FilesPage
							key={page}
							pullRequest={pullRequest}
							page={page}
							isLast={index === pages.length - 1}
							threadsByPath={threadsByPath}
							nowMs={nowMs}
							onShowEdits={showEdits}
							onLoadPage={loadPage}
						/>
					))}
				</PullRequestReactionsProvider>
			</ApiImageAuthorizationProvider>
			<EditHistorySheet nodeId={editsOf} nowMs={nowMs} onClose={closeEdits} />
		</Screen>
	);
}

interface FilesPageProps {
	readonly pullRequest: GithubPullRequestParams;
	readonly page: number;
	readonly isLast: boolean;
	readonly threadsByPath: ReadonlyMap<string, readonly GithubReviewThread[]>;
	readonly nowMs: number;
	readonly onShowEdits: (nodeId: string) => void;
	readonly onLoadPage: (page: number) => void;
}

function FilesPage({ pullRequest, page, isLast, threadsByPath, nowMs, onShowEdits, onLoadPage }: FilesPageProps): React.JSX.Element {
	const api = useApi();
	const files = api.githubPullRequests.files.useQuery({ ...pullRequest, page });
	const retry = React.useCallback((): void => {
		void files.refetch();
	}, [files]);
	const nextPage = files.data?.data.nextPage ?? null;
	const loadNext = React.useCallback((): void => {
		if (nextPage !== null) {
			onLoadPage(nextPage);
		}
	}, [nextPage, onLoadPage]);
	if (files.isPending) {
		return (
			<SkeletonGroup accessibilityLabel="Loading the changed files" testID="pull-request-files-skeleton" className="gap-3">
				<SkeletonText size="sm" widthClassName="w-2/3" />
				<Skeleton className="h-40 w-full rounded-lg" />
				<Skeleton className="h-12 w-full rounded-lg" />
			</SkeletonGroup>
		);
	}
	if (files.isError) {
		return <ErrorState message={errorMessageOf(files.error)} retryLabel="Try again" onRetry={retry} />;
	}
	const pageFiles = files.data.data.files;
	if (page === FIRST_FILES_PAGE && pageFiles.length === 0) {
		return <EmptyState message="This pull request doesn't change any files." />;
	}
	return (
		<FileList files={pageFiles} threadsByPath={threadsByPath} nowMs={nowMs} onShowEdits={onShowEdits}>
			{isLast && nextPage !== null ? <Button label="Load more files" variant="secondary" onPress={loadNext} testID="pull-request-files-more" /> : null}
		</FileList>
	);
}

interface FileListProps {
	readonly files: readonly GithubCommitFile[];
	readonly threadsByPath: ReadonlyMap<string, readonly GithubReviewThread[]>;
	readonly nowMs: number;
	readonly onShowEdits: (nodeId: string) => void;
	readonly children: React.ReactNode;
}

function FileList({ files, threadsByPath, nowMs, onShowEdits, children }: FileListProps): React.JSX.Element {
	const [expandedPaths, setExpandedPaths] = React.useState<ReadonlySet<string>>(() => initiallyExpandedPaths(files));
	const toggleFile = React.useCallback((path: string): void => {
		setExpandedPaths((current: ReadonlySet<string>): ReadonlySet<string> => {
			const next = new Set(current);
			if (!next.delete(path)) {
				next.add(path);
			}
			return next;
		});
	}, []);
	return (
		<View className="gap-3">
			{files.map((file: GithubCommitFile): React.JSX.Element => (
				<PullRequestFile
					key={file.path}
					file={file}
					threads={threadsByPath.get(file.path) ?? []}
					expanded={expandedPaths.has(file.path)}
					onToggle={toggleFile}
					nowMs={nowMs}
					onShowEdits={onShowEdits}
				/>
			))}
			{children}
		</View>
	);
}

interface PullRequestFileProps {
	readonly file: GithubCommitFile;
	readonly threads: readonly GithubReviewThread[];
	readonly expanded: boolean;
	readonly onToggle: (path: string) => void;
	readonly nowMs: number;
	readonly onShowEdits: (nodeId: string) => void;
}

const PullRequestFile = React.memo(function PullRequestFile({ file, threads, expanded, onToggle, nowMs, onShowEdits }: PullRequestFileProps): React.JSX.Element {
	const toggle = React.useCallback((): void => {
		onToggle(file.path);
	}, [file.path, onToggle]);
	const threaded = React.useMemo(() => (expanded && file.diff.kind === "patch" ? threadDiff(parsePatch(file.diff.patch), threads) : null), [expanded, file.diff, threads]);
	const message = missingDiffMessage(file.diff);
	const status = FILE_STATUS_ICONS[file.status];
	const commentCount = threads.reduce((total: number, thread: GithubReviewThread): number => total + thread.comments.length, 0);
	return (
		<ChangedFile
			path={file.path}
			previousPath={file.previousPath}
			statusLabel={fileStatusLabel(file.status)}
			statusIcon={status.icon}
			statusColorClassName={status.colorClassName}
			additions={formatCount(file.additions)}
			deletions={formatCount(file.deletions)}
			changeSummary={
				commentCount === 0 ? changeSummary(file.additions, file.deletions) : `${changeSummary(file.additions, file.deletions)}, ${formatCount(commentCount)} comments`
			}
			blocks={diffStatBlocks(file.additions, file.deletions)}
			expanded={expanded}
			onToggle={toggle}>
			{message !== null || threaded === null ? (
				<View className="gap-3 px-4 py-3">
					{message === null ? null : <MutedText>{message}</MutedText>}
					{threads.map((thread: GithubReviewThread): React.JSX.Element => (
						<ThreadCard key={thread.id} thread={thread} nowMs={nowMs} onShowEdits={onShowEdits} />
					))}
				</View>
			) : (
				<View>
					{threaded.outdated.length === 0 ? null : <ThreadList threads={threaded.outdated} nowMs={nowMs} onShowEdits={onShowEdits} />}
					{threaded.segments.map((segment: DiffSegment): React.JSX.Element =>
						segment.kind === "lines" ? (
							<DiffView key={segment.key} lines={segment.lines} />
						) : (
							<ThreadList key={segment.key} threads={segment.threads} nowMs={nowMs} onShowEdits={onShowEdits} />
						),
					)}
					{threaded.unplaced.length === 0 ? null : <ThreadList threads={threaded.unplaced} nowMs={nowMs} onShowEdits={onShowEdits} />}
				</View>
			)}
		</ChangedFile>
	);
});

interface ThreadListProps {
	readonly threads: readonly GithubReviewThread[];
	readonly nowMs: number;
	readonly onShowEdits: (nodeId: string) => void;
}

/** Threads full-width between diff lines, on the page's colour so they read apart from the code. */
function ThreadList({ threads, nowMs, onShowEdits }: ThreadListProps): React.JSX.Element {
	return (
		<View className="gap-3 border-y border-border bg-background px-3 py-3">
			{threads.map((thread: GithubReviewThread): React.JSX.Element => (
				<ThreadCard key={thread.id} thread={thread} nowMs={nowMs} onShowEdits={onShowEdits} />
			))}
		</View>
	);
}

/** One conversation on a line: resolved / outdated said up front, then its comments. */
function ThreadCard({
	thread,
	nowMs,
	onShowEdits,
}: {
	readonly thread: GithubReviewThread;
	readonly nowMs: number;
	readonly onShowEdits: (nodeId: string) => void;
}): React.JSX.Element {
	const flags = [thread.isOutdated ? "Outdated" : null, thread.isResolved ? "Resolved" : null].filter((flag: string | null): flag is string => flag !== null);
	return (
		<View className="gap-2" testID={`thread-${thread.id}`}>
			{flags.length === 0 ? null : <Text className="font-sans-medium text-xs text-muted-foreground">{flags.join(" · ")}</Text>}
			{thread.comments.map((comment: GithubReviewComment): React.JSX.Element => (
				<CommentCard key={comment.id} comment={comment} action={commentedLabel(comment.createdAt, nowMs)} onShowEdits={onShowEdits} />
			))}
		</View>
	);
}
