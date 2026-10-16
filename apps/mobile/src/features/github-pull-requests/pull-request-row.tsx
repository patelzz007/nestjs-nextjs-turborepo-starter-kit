// One pull request in the list, as GitHub's app lists it: the state glyph,
// `owner/repo #42`, the title, who opened it and when, the comment count and
// its labels. Presentational: pressing it calls back with the pull request.

import type { GithubLabel, GithubPullRequestSummary } from "@workspace/shared";
import MessageSquareIcon from "lucide-react-native/icons/message-square";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@workspace/ui-native/components/icon";
import { formatCount } from "../github/labels";
import { displayStateOf, listRowMeta, pullRequestReference, reviewDecisionLabel, DISPLAY_STATE_LABELS } from "./labels";
import { LabelChip, PullRequestStateGlyph } from "./pull-request-badges";

export interface PullRequestRowProps {
	readonly pullRequest: GithubPullRequestSummary;
	readonly nowMs: number;
	readonly onOpen: (pullRequest: GithubPullRequestSummary) => void;
}

export const PullRequestRow = React.memo(function PullRequestRow({ pullRequest, nowMs, onOpen }: PullRequestRowProps): React.JSX.Element {
	const open = React.useCallback((): void => {
		onOpen(pullRequest);
	}, [onOpen, pullRequest]);
	const state = displayStateOf(pullRequest);
	const decision = reviewDecisionLabel(pullRequest.reviewDecision);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${DISPLAY_STATE_LABELS[state]} pull request ${pullRequestReference(pullRequest)}: ${pullRequest.title}`}
			accessibilityHint="Opens the pull request"
			onPress={open}
			testID={`pull-request-${pullRequest.owner}-${pullRequest.repository}-${String(pullRequest.number)}`}
			className="flex-row gap-3 border-b border-border py-3.5 active:opacity-70">
			<View className="pt-0.5">
				<PullRequestStateGlyph state={state} />
			</View>
			<View className="flex-1 gap-1.5">
				<Text numberOfLines={1} className="font-sans text-xs text-muted-foreground">
					{pullRequestReference(pullRequest)}
				</Text>
				<Text numberOfLines={2} className="font-sans-semibold text-base leading-6 text-foreground">
					{pullRequest.title}
				</Text>
				<View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
					<Text className="font-sans text-xs text-muted-foreground">{listRowMeta(pullRequest, nowMs)}</Text>
					{decision === null ? null : <Text className="font-sans text-xs text-muted-foreground">{decision}</Text>}
					{pullRequest.commentCount === 0 ? null : (
						<View accessible accessibilityLabel={`${formatCount(pullRequest.commentCount)} comments`} className="flex-row items-center gap-1">
							<Icon icon={MessageSquareIcon} size="sm" colorClassName="accent-muted-foreground" />
							<Text className="font-sans text-xs text-muted-foreground">{formatCount(pullRequest.commentCount)}</Text>
						</View>
					)}
				</View>
				{pullRequest.labels.length === 0 ? null : (
					<View className="flex-row flex-wrap gap-1.5">
						{pullRequest.labels.map((label: GithubLabel): React.JSX.Element => (
							<LabelChip key={label.name} label={label} />
						))}
					</View>
				)}
			</View>
		</Pressable>
	);
});
