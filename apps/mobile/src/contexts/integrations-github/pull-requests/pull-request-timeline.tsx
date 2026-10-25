// A pull request's conversation, drawn the way GitHub draws it: one line down
// the left with every entry on it. A comment is a card — its author's avatar
// on the line, a tinted header ("octocat commented 2 hours ago", "Author",
// "edited"), then the markdown. A review puts its verdict on the line in its
// colour, then its summary and the line comments it left, each with its code.
// A pushed commit and an event (labelled, closed, review requested) are one
// line beside a small icon. Presentational — the screen passes the entries
// and what to do when an edit history or a commit is asked for. Each comment
// ends with its emoji reactions (comment-reactions.tsx), which may be changed
// when the screen names the pull request (PullRequestReactionsProvider).

import { type GithubActor, type GithubComment, type GithubReviewComment, type GithubReviewState, type GithubTimelineItem } from "@workspace/shared";
import CheckIcon from "lucide-react-native/icons/check";
import EyeIcon from "lucide-react-native/icons/eye";
import FileDiffIcon from "lucide-react-native/icons/file-diff";
import GitCommitVerticalIcon from "lucide-react-native/icons/git-commit-vertical";
import GitMergeIcon from "lucide-react-native/icons/git-merge";
import GitPullRequestClosedIcon from "lucide-react-native/icons/git-pull-request-closed";
import GitPullRequestIcon from "lucide-react-native/icons/git-pull-request";
import GitPullRequestDraftIcon from "lucide-react-native/icons/git-pull-request-draft";
import PencilIcon from "lucide-react-native/icons/pencil";
import RepeatIcon from "lucide-react-native/icons/repeat";
import TagIcon from "lucide-react-native/icons/tag";
import UserPlusIcon from "lucide-react-native/icons/user-plus";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@workspace/ui-native/components/avatar";
import { DiffView } from "../../../components/diff-view";
import { type LucideIcon } from "@workspace/ui-native/components/icon";
import { Markdown } from "../../../components/markdown";
import { TimelineRailIcon, TimelineRailItem, type TimelineRailTone } from "@workspace/ui-native/components/timeline-rail";
import { formatRelativeTime } from "../../../lib/time-format";
import { parsePatch } from "../github/diff";
import { CommentReactions } from "./comment-reactions";
import { AUTHOR_BADGE, commentedLabel, editedLabel, eventSentence, loginOf, reviewedLabel } from "./labels";
import { useGithubPictureLoader } from "./use-github-picture-loader";

/** Lines of a line comment's code shown above it — the end of its hunk, as GitHub shows. */
const REVIEW_COMMENT_CONTEXT_LINES = 4;

interface ReviewStyle {
	readonly icon: LucideIcon;
	readonly tone: TimelineRailTone;
}

const REVIEW_STYLES: Readonly<Record<GithubReviewState, ReviewStyle>> = {
	approved: { icon: CheckIcon, tone: "success" },
	changesRequested: { icon: FileDiffIcon, tone: "danger" },
	commented: { icon: EyeIcon, tone: "neutral" },
	dismissed: { icon: XIcon, tone: "neutral" },
	pending: { icon: EyeIcon, tone: "attention" },
};

type EventKind = Extract<GithubTimelineItem, { readonly type: "event" }>["kind"];

const EVENT_STYLES: Readonly<Record<EventKind, ReviewStyle>> = {
	closed: { icon: GitPullRequestClosedIcon, tone: "danger" },
	reopened: { icon: GitPullRequestIcon, tone: "success" },
	merged: { icon: GitMergeIcon, tone: "done" },
	readyForReview: { icon: GitPullRequestIcon, tone: "neutral" },
	convertedToDraft: { icon: GitPullRequestDraftIcon, tone: "neutral" },
	reviewRequested: { icon: UserPlusIcon, tone: "neutral" },
	labeled: { icon: TagIcon, tone: "neutral" },
	unlabeled: { icon: TagIcon, tone: "neutral" },
	headRefForcePushed: { icon: RepeatIcon, tone: "neutral" },
	renamed: { icon: PencilIcon, tone: "neutral" },
};

export interface PullRequestTimelineProps {
	readonly items: readonly GithubTimelineItem[];
	readonly nowMs: number;
	/** The pull request's author — their comments carry GitHub's "Author" badge. */
	readonly pullRequestAuthor: string | null;
	/** Opens the saved versions of a comment, review or description. */
	readonly onShowEdits: (nodeId: string) => void;
	/** Opens a pushed commit's own screen. */
	readonly onOpenCommit: (sha: string) => void;
}

export function PullRequestTimeline({ items, nowMs, pullRequestAuthor, onShowEdits, onOpenCommit }: PullRequestTimelineProps): React.JSX.Element {
	return (
		<View testID="pull-request-timeline">
			{items.map((item: GithubTimelineItem): React.JSX.Element => (
				<TimelineEntry key={keyOf(item)} item={item} nowMs={nowMs} pullRequestAuthor={pullRequestAuthor} onShowEdits={onShowEdits} onOpenCommit={onOpenCommit} />
			))}
		</View>
	);
}

/** Whether a comment's author opened the pull request (a deleted account never did). */
function wroteThePullRequest(author: GithubActor | null, pullRequestAuthor: string | null): boolean {
	return author?.login === pullRequestAuthor;
}

/** Stable per entry: a node id, a commit SHA, or an event's kind and time. */
function keyOf(item: GithubTimelineItem): string {
	switch (item.type) {
		case "comment":
			return item.comment.id;
		case "review":
			return item.review.id;
		case "commit":
			return item.commit.sha;
		case "event":
			return `${item.kind}:${String(item.createdAt)}:${item.detail ?? ""}`;
	}
}

interface TimelineEntryProps {
	readonly item: GithubTimelineItem;
	readonly nowMs: number;
	readonly pullRequestAuthor: string | null;
	readonly onShowEdits: (nodeId: string) => void;
	readonly onOpenCommit: (sha: string) => void;
}

const TimelineEntry = React.memo(function TimelineEntry({ item, nowMs, pullRequestAuthor, onShowEdits, onOpenCommit }: TimelineEntryProps): React.JSX.Element {
	switch (item.type) {
		case "comment":
			return (
				<TimelineRailItem node={<Avatar name={loginOf(item.comment.author)} imageUrl={item.comment.author?.avatarUrl ?? null} size="md" />}>
					<CommentCard
						comment={item.comment}
						action={commentedLabel(item.comment.createdAt, nowMs)}
						isPullRequestAuthor={wroteThePullRequest(item.comment.author, pullRequestAuthor)}
						showAvatar={false}
						onShowEdits={onShowEdits}
					/>
				</TimelineRailItem>
			);
		case "review":
			return <ReviewEntry item={item} nowMs={nowMs} pullRequestAuthor={pullRequestAuthor} onShowEdits={onShowEdits} />;
		case "commit":
			return <CommitEntry item={item} onOpenCommit={onOpenCommit} />;
		case "event": {
			const style = EVENT_STYLES[item.kind];
			const sentence = `${loginOf(item.actor)} ${eventSentence(item.kind, item.detail)} ${formatRelativeTime(item.createdAt, nowMs)}`;
			return (
				<TimelineRailItem node={<TimelineRailIcon icon={style.icon} tone={style.tone} />} compact>
					<Text accessible accessibilityLabel={sentence} className="font-sans text-sm leading-5 text-muted-foreground">
						<Text className="font-sans-semibold text-foreground">{loginOf(item.actor)}</Text> {eventSentence(item.kind, item.detail)}{" "}
						{formatRelativeTime(item.createdAt, nowMs)}
					</Text>
				</TimelineRailItem>
			);
		}
	}
});

/** A pushed commit: its headline and short SHA, opening its diff in the app. */
function CommitEntry({
	item,
	onOpenCommit,
}: {
	readonly item: Extract<GithubTimelineItem, { readonly type: "commit" }>;
	readonly onOpenCommit: (sha: string) => void;
}): React.JSX.Element {
	const open = React.useCallback((): void => {
		onOpenCommit(item.commit.sha);
	}, [item.commit.sha, onOpenCommit]);
	return (
		<TimelineRailItem node={<TimelineRailIcon icon={GitCommitVerticalIcon} />} compact>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`Commit ${item.commit.shortSha}: ${item.commit.headline}`}
				accessibilityHint="Shows the commit's changes"
				onPress={open}
				className="min-h-11 flex-row items-center gap-3 active:opacity-70">
				<Text numberOfLines={1} className="flex-1 font-sans text-sm text-foreground">
					{item.commit.headline}
				</Text>
				<Text className="font-mono text-xs text-muted-foreground">{item.commit.shortSha}</Text>
			</Pressable>
		</TimelineRailItem>
	);
}

interface CommentCardProps {
	readonly comment: GithubComment;
	/** What the author did, after their name ("commented 2 hours ago"). */
	readonly action: string;
	/** The author opened the pull request: GitHub's "Author" badge. */
	readonly isPullRequestAuthor?: boolean;
	/** Off on the conversation's line, where the avatar is the entry's node. */
	readonly showAvatar?: boolean;
	readonly onShowEdits: (nodeId: string) => void;
}

/** One comment as GitHub shows it: a tinted header (who, what, when, "Author", "edited"), then the markdown. */
export function CommentCard({ comment, action, isPullRequestAuthor = false, showAvatar = true, onShowEdits }: CommentCardProps): React.JSX.Element {
	const login = loginOf(comment.author);
	const edited = editedLabel(comment.lastEditedAt);
	const showEdits = React.useCallback((): void => {
		onShowEdits(comment.id);
	}, [comment.id, onShowEdits]);
	// Each picture loads from where the API listed it — signed in, for one GitHub shows only to signed-in readers.
	const images = useGithubPictureLoader(comment.images);
	return (
		<View className="overflow-hidden rounded-xl border border-border bg-card" testID={`comment-${comment.id}`}>
			<View className="min-h-11 flex-row items-center gap-2 border-b border-border bg-muted px-3 py-2">
				{showAvatar ? <Avatar name={login} imageUrl={comment.author?.avatarUrl ?? null} size="sm" /> : null}
				<Text className="flex-1 font-sans text-sm text-muted-foreground" numberOfLines={2}>
					<Text className="font-sans-semibold text-foreground">{login}</Text> {action}
				</Text>
				{isPullRequestAuthor ? (
					<View className="rounded-full border border-border px-2 py-0.5">
						<Text className="font-sans-medium text-xs text-muted-foreground">{AUTHOR_BADGE}</Text>
					</View>
				) : null}
				{edited === null ? null : (
					<Pressable
						accessibilityLabel={`Edited: ${login}'s text`}
						accessibilityRole="button"
						accessibilityHint="Shows every saved version"
						onPress={showEdits}
						hitSlop={8}
						className="min-h-9 justify-center active:opacity-60">
						<Text className="font-sans text-sm text-muted-foreground underline">{edited}</Text>
					</Pressable>
				)}
			</View>
			<View className="gap-3 px-3 py-3">
				<Markdown source={comment.body} emptyMessage="No description provided." images={images} />
				<CommentReactions reactions={comment.reactions} subject={comment.reactionSubject} testID={`reactions-${comment.id}`} />
			</View>
		</View>
	);
}

interface ReviewEntryProps {
	readonly item: Extract<GithubTimelineItem, { readonly type: "review" }>;
	readonly nowMs: number;
	readonly pullRequestAuthor: string | null;
	readonly onShowEdits: (nodeId: string) => void;
}

/** A review: its verdict on the line in its colour, then its summary (when it has one) and the line comments it left. */
function ReviewEntry({ item, nowMs, pullRequestAuthor, onShowEdits }: ReviewEntryProps): React.JSX.Element {
	const { review } = item;
	const style = REVIEW_STYLES[review.state];
	const verdict = reviewedLabel(review.state, review.submittedAt ?? review.createdAt, nowMs);
	return (
		<TimelineRailItem node={<TimelineRailIcon icon={style.icon} tone={style.tone} />} testID={`review-${review.id}`}>
			<View className="gap-3">
				<View className="min-h-8 flex-row items-center gap-2">
					<Avatar name={loginOf(review.author)} imageUrl={review.author?.avatarUrl ?? null} size="sm" />
					<Text className="flex-1 font-sans text-sm text-muted-foreground">
						<Text className="font-sans-semibold text-foreground">{loginOf(review.author)}</Text> {verdict}
					</Text>
				</View>
				{review.body.trim().length === 0 ? null : (
					<CommentCard comment={review} action="left a review" isPullRequestAuthor={wroteThePullRequest(review.author, pullRequestAuthor)} onShowEdits={onShowEdits} />
				)}
				{review.comments.map((comment: GithubReviewComment): React.JSX.Element => (
					<ReviewCommentCard key={comment.id} comment={comment} nowMs={nowMs} onShowEdits={onShowEdits} />
				))}
			</View>
		</TimelineRailItem>
	);
}

interface ReviewCommentCardProps {
	readonly comment: GithubReviewComment;
	readonly nowMs: number;
	readonly onShowEdits: (nodeId: string) => void;
}

/** A line comment: the file and the last lines of its hunk, then the comment. */
export function ReviewCommentCard({ comment, nowMs, onShowEdits }: ReviewCommentCardProps): React.JSX.Element {
	const lines = React.useMemo(() => parsePatch(comment.diffHunk).slice(-REVIEW_COMMENT_CONTEXT_LINES), [comment.diffHunk]);
	return (
		<View className="overflow-hidden rounded-xl border border-border bg-card">
			<Text numberOfLines={1} className="border-b border-border bg-muted px-3 py-2 font-mono text-xs text-foreground">
				{comment.path}
			</Text>
			<DiffView lines={lines} />
			<View className="border-t border-border p-2">
				<CommentCard comment={comment} action={commentedLabel(comment.createdAt, nowMs)} onShowEdits={onShowEdits} />
			</View>
		</View>
	);
}
