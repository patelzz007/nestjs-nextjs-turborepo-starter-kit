// ============================================
// One GitHub commit — the commit screen's content (smart)
// ============================================
// Reads GET /github/repositories/:owner/:repository/commits/:sha and lays it
// out like GitHub's commit page: the message, who committed it and when, its
// SHA (tap to copy) and parents; then how many files changed, and each file
// with its diff. Files with short diffs open expanded, the rest collapsed
// (diff.ts), so a large commit stays quick to draw. "View on GitHub" opens the
// commit in the browser.
// docs/technical/github-contributions.md

import type { GithubCommitDetail, GithubCommitFile, GithubCommitFileStatus, GithubCommitParams, GithubCommitParent } from "@workspace/shared";
import * as Clipboard from "expo-clipboard";
import CopyIcon from "lucide-react-native/icons/copy";
import FileDiffIcon from "lucide-react-native/icons/file-diff";
import FileMinusIcon from "lucide-react-native/icons/file-minus";
import FilePlusIcon from "lucide-react-native/icons/file-plus";
import FileSymlinkIcon from "lucide-react-native/icons/file-symlink";
import * as React from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { Avatar } from "../../components/avatar";
import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { ChangedFile } from "../../components/changed-file";
import { DiffStat } from "../../components/diff-stat";
import { DiffView } from "../../components/diff-view";
import { Icon, type LucideIcon } from "../../components/icon";
import { Screen } from "../../components/screen";
import { Skeleton, SkeletonGroup, SkeletonText } from "../../components/skeleton";
import { EmptyState, ErrorState } from "../../components/states";
import { MutedText } from "../../components/text";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { useNow } from "../../lib/use-now";
import { useToast } from "../toast/facade";
import { diffStatBlocks, initiallyExpandedPaths, parsePatch } from "./diff";
import {
	changedFilesSummary,
	changeSummary,
	commitAuthorName,
	commitBody,
	committedLabel,
	fileStatusLabel,
	formatCount,
	missingDiffMessage,
	MORE_FILES_ON_GITHUB,
	OPEN_GITHUB_FAILED_MESSAGE,
	parentsLabel,
} from "./labels";

export const COMMIT_SHA_COPIED_MESSAGE = "Commit SHA copied.";
export const COMMIT_SHA_COPY_FAILED_MESSAGE = "Couldn't copy the commit SHA. Try again.";

/** "committed 2 hours ago" is re-read this often. */
const RELATIVE_TIME_REFRESH_MS = 60_000;

interface FileStatusIcon {
	readonly icon: LucideIcon;
	readonly colorClassName: string;
}

/** GitHub's file-status glyphs: added green, deleted red, moved blue, edited grey. */
const FILE_STATUS_ICONS: Readonly<Record<GithubCommitFileStatus, FileStatusIcon>> = {
	added: { icon: FilePlusIcon, colorClassName: "accent-success-foreground" },
	removed: { icon: FileMinusIcon, colorClassName: "accent-destructive-foreground" },
	renamed: { icon: FileSymlinkIcon, colorClassName: "accent-info-foreground" },
	copied: { icon: FileSymlinkIcon, colorClassName: "accent-info-foreground" },
	modified: { icon: FileDiffIcon, colorClassName: "accent-muted-foreground" },
	changed: { icon: FileDiffIcon, colorClassName: "accent-muted-foreground" },
	unchanged: { icon: FileDiffIcon, colorClassName: "accent-muted-foreground" },
};

export interface GithubCommitDetailScreenProps {
	readonly commit: GithubCommitParams;
}

export function GithubCommitDetailScreen({ commit }: GithubCommitDetailScreenProps): React.JSX.Element {
	const api = useApi();
	const detail = api.github.repositoryCommit.useQuery(commit);
	const nowMs = useNow({ intervalMs: RELATIVE_TIME_REFRESH_MS, running: true });
	const refetch = React.useCallback((): void => {
		void detail.refetch();
	}, [detail]);

	return (
		<Screen refreshing={detail.isRefetching} onRefresh={refetch} testID="github-commit">
			{detail.isPending ? <CommitSkeleton /> : null}
			{detail.isError ? <ErrorState message={errorMessageOf(detail.error)} retryLabel="Try again" onRetry={refetch} /> : null}
			{/* Keyed by SHA: another commit starts with its own files expanded. */}
			{detail.data === undefined ? null : <CommitView key={detail.data.data.sha} commit={detail.data.data} nowMs={nowMs} />}
		</Screen>
	);
}

interface CommitViewProps {
	readonly commit: GithubCommitDetail;
	readonly nowMs: number;
}

function CommitView({ commit, nowMs }: CommitViewProps): React.JSX.Element {
	const [expandedPaths, setExpandedPaths] = React.useState<ReadonlySet<string>>(() => initiallyExpandedPaths(commit.files));
	const [openFailed, setOpenFailed] = React.useState(false);
	const toggleFile = React.useCallback((path: string): void => {
		setExpandedPaths((current: ReadonlySet<string>): ReadonlySet<string> => {
			const next = new Set(current);
			if (!next.delete(path)) {
				next.add(path);
			}
			return next;
		});
	}, []);
	const openOnGithub = React.useCallback((): void => {
		setOpenFailed(false);
		Linking.openURL(commit.htmlUrl).catch((): void => {
			setOpenFailed(true);
		});
	}, [commit.htmlUrl]);

	return (
		<>
			<CommitHeader commit={commit} nowMs={nowMs} />
			<View className="flex-row items-center gap-3">
				<MutedText className="flex-1">{changedFilesSummary(commit)}</MutedText>
				<DiffStat blocks={diffStatBlocks(commit.additions, commit.deletions)} testID="github-commit-diffstat" />
			</View>
			{commit.filesTruncated ? <Banner tone="info" message={MORE_FILES_ON_GITHUB} /> : null}
			{commit.files.length === 0 ? (
				<EmptyState message="This commit doesn't change any files." />
			) : (
				<View className="gap-3">
					{commit.files.map((file: GithubCommitFile): React.JSX.Element => (
						<CommitFile key={file.path} file={file} expanded={expandedPaths.has(file.path)} onToggle={toggleFile} />
					))}
				</View>
			)}
			{openFailed ? <Banner tone="error" message={OPEN_GITHUB_FAILED_MESSAGE} /> : null}
			<Button label="View on GitHub" variant="secondary" accessibilityHint="Opens the commit in your browser" onPress={openOnGithub} />
		</>
	);
}

interface CommitHeaderProps {
	readonly commit: GithubCommitDetail;
	readonly nowMs: number;
}

/** The message, the author and when, the SHA and the parents — the top of GitHub's commit page. */
function CommitHeader({ commit, nowMs }: CommitHeaderProps): React.JSX.Element {
	const body = commitBody(commit);
	const author = commitAuthorName(commit);
	return (
		<Card>
			<View className="gap-2">
				<Text accessibilityRole="header" selectable className="font-sans-semibold text-lg leading-6 text-foreground">
					{commit.headline}
				</Text>
				{body === null ? null : (
					<Text selectable className="font-mono text-sm leading-5 text-muted-foreground">
						{body}
					</Text>
				)}
			</View>
			<View className="flex-row items-center gap-2">
				<Avatar name={author} imageUrl={commit.author.avatarUrl} size="sm" />
				<Text className="flex-1 font-sans text-sm text-muted-foreground">
					<Text className="font-sans-semibold text-foreground">{author}</Text> {committedLabel(commit, nowMs)}
				</Text>
			</View>
			<View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
				<CopyShaButton sha={commit.sha} shortSha={commit.shortSha} />
				{commit.parents.length === 0 ? null : (
					<View className="flex-row flex-wrap items-center gap-2">
						<MutedText>{parentsLabel(commit.parents.length)}</MutedText>
						{commit.parents.map((parent: GithubCommitParent): React.JSX.Element => (
							<Text key={parent.sha} selectable className="font-mono text-sm text-foreground">
								{parent.shortSha}
							</Text>
						))}
					</View>
				)}
			</View>
		</Card>
	);
}

interface CopyShaButtonProps {
	readonly sha: string;
	readonly shortSha: string;
}

/** The short SHA in a chip; pressing it copies the full SHA and says so. */
function CopyShaButton({ sha, shortSha }: CopyShaButtonProps): React.JSX.Element {
	const toast = useToast();
	const copy = React.useCallback((): void => {
		Clipboard.setStringAsync(sha)
			.then((): void => {
				toast.success(COMMIT_SHA_COPIED_MESSAGE);
			})
			.catch((): void => {
				toast.error(COMMIT_SHA_COPY_FAILED_MESSAGE);
			});
	}, [sha, toast]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Commit ${shortSha}`}
			accessibilityHint="Copies the full commit SHA"
			onPress={copy}
			hitSlop={8}
			className="min-h-9 flex-row items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 active:opacity-70">
			<Text className="font-mono text-sm text-foreground">{shortSha}</Text>
			<Icon icon={CopyIcon} size="sm" colorClassName="accent-muted-foreground" />
		</Pressable>
	);
}

interface CommitFileProps {
	readonly file: GithubCommitFile;
	readonly expanded: boolean;
	readonly onToggle: (path: string) => void;
}

/** One file: its header always, its diff (parsed only once opened) while expanded. */
const CommitFile = React.memo(function CommitFile({ file, expanded, onToggle }: CommitFileProps): React.JSX.Element {
	const toggle = React.useCallback((): void => {
		onToggle(file.path);
	}, [file.path, onToggle]);
	const lines = React.useMemo(() => (expanded && file.diff.kind === "patch" ? parsePatch(file.diff.patch) : []), [expanded, file.diff]);
	const message = missingDiffMessage(file.diff);
	const status = FILE_STATUS_ICONS[file.status];
	return (
		<ChangedFile
			path={file.path}
			previousPath={file.previousPath}
			statusLabel={fileStatusLabel(file.status)}
			statusIcon={status.icon}
			statusColorClassName={status.colorClassName}
			additions={formatCount(file.additions)}
			deletions={formatCount(file.deletions)}
			changeSummary={changeSummary(file.additions, file.deletions)}
			blocks={diffStatBlocks(file.additions, file.deletions)}
			expanded={expanded}
			onToggle={toggle}>
			{message === null ? (
				<DiffView lines={lines} />
			) : (
				<View className="px-4 py-3">
					<MutedText>{message}</MutedText>
				</View>
			)}
		</ChangedFile>
	);
});

/** The commit's shape while it loads: the header card and two files. */
function CommitSkeleton(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading the commit" testID="github-commit-skeleton" className="gap-5">
			<Card>
				<SkeletonText size="lg" widthClassName="w-3/4" />
				<SkeletonText size="sm" widthClassName="w-1/2" />
				<Skeleton className="h-9 w-28 rounded-md" />
			</Card>
			<SkeletonText size="sm" widthClassName="w-2/3" />
			<Skeleton className="h-40 w-full rounded-lg" />
			<Skeleton className="h-12 w-full rounded-lg" />
		</SkeletonGroup>
	);
}
