// ============================================
// comment-reactions.tsx - Emoji reactions on a pull request's comments (ADR 052)
// ============================================
// Under the description and each comment: GitHub's reactions, and — where
// GitHub takes reactions from an API (not a review's summary) — adding or
// taking away your own, on GitHub, as the linked account. The change shows at
// once and is undone, with GitHub's reason, if GitHub refuses it; then every
// view of the pull request reloads. Which pull request is the screen's to say
// (`PullRequestReactionsProvider`); without it the reactions are shown only.

import { useQueryClient } from "@tanstack/react-query";
import {
	GITHUB_REACTION_CONTENTS,
	GITHUB_REACTION_EMOJI,
	GITHUB_REACTION_NAMES,
	withViewerReaction,
	type GithubPullRequestParams,
	type GithubReactionContent,
	type GithubReactionGroup,
	type GithubReactionSubject,
} from "@workspace/shared";
import * as React from "react";

import { ReactionBar, type Reaction, type ReactionChoice } from "../../components/reaction-bar";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { useToast } from "../toast/facade";
import { refreshPullRequest } from "./refresh";

const PullRequestReactionsContext = React.createContext<GithubPullRequestParams | null>(null);
PullRequestReactionsContext.displayName = "PullRequestReactions";

export interface PullRequestReactionsProviderProps {
	readonly pullRequest: GithubPullRequestParams;
	readonly children: React.ReactNode;
}

/** The pull request whose comments the reactions inside belong to. */
export function PullRequestReactionsProvider({ pullRequest, children }: PullRequestReactionsProviderProps): React.JSX.Element {
	return <PullRequestReactionsContext.Provider value={pullRequest}>{children}</PullRequestReactionsContext.Provider>;
}

/** GitHub's eight reactions as the picker offers them. */
const REACTION_CHOICES: readonly ReactionChoice<GithubReactionContent>[] = GITHUB_REACTION_CONTENTS.map(
	(content: GithubReactionContent): ReactionChoice<GithubReactionContent> => ({ key: content, emoji: GITHUB_REACTION_EMOJI[content], name: GITHUB_REACTION_NAMES[content] }),
);

function toReaction(group: GithubReactionGroup): Reaction<GithubReactionContent> {
	return { key: group.content, count: group.count, mine: group.viewerHasReacted };
}

/** What is shown while a change is on its way: the reactions it was made on, and the result. */
interface PendingReactions {
	readonly base: readonly GithubReactionGroup[];
	readonly groups: readonly GithubReactionGroup[];
}

export interface CommentReactionsProps {
	readonly reactions: readonly GithubReactionGroup[];
	/** What GitHub reacts to; `null` shows the reactions without letting them change. */
	readonly subject: GithubReactionSubject | null;
	readonly testID?: string;
}

export function CommentReactions({ reactions, subject, testID }: CommentReactionsProps): React.JSX.Element | null {
	const pullRequest = React.useContext(PullRequestReactionsContext);
	const api = useApi();
	const queryClient = useQueryClient();
	const toast = useToast();
	const setReaction = api.githubPullRequests.setReaction.useMutation();
	const [pending, setPending] = React.useState<PendingReactions | null>(null);
	// A fresh read of the pull request replaces whatever was shown while a change was on its way.
	const shown = pending !== null && pending.base === reactions ? pending.groups : reactions;

	const toggle = React.useCallback(
		(content: GithubReactionContent, reacted: boolean): void => {
			if (pullRequest === null || subject === null) {
				return;
			}
			setPending({ base: reactions, groups: withViewerReaction(shown, content, reacted) });
			setReaction
				.mutateAsync({ ...pullRequest, subject, content, reacted })
				.then(async (): Promise<void> => {
					await refreshPullRequest(queryClient, pullRequest);
				})
				.catch((error: unknown): void => {
					setPending(null);
					toast.error(errorMessageOf(error instanceof Error ? error : null));
				});
		},
		[pullRequest, queryClient, reactions, setReaction, shown, subject, toast],
	);

	const canReact = pullRequest !== null && subject !== null;
	return <ReactionBar reactions={shown.map(toReaction)} choices={REACTION_CHOICES} onToggle={canReact ? toggle : undefined} testID={testID} />;
}
